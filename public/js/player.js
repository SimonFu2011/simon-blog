/* ==========================================================================
   player.js —— 独立浮窗音乐播放器
   特性：拖动 / 最小化 / 上一首 / 下一首 / 进度 / 音量 / 歌单点歌
        位置与状态存 localStorage；页面加载不自动播放；返回入场页不中断
   ========================================================================== */
'use strict';

App.player = (function () {
  const els = {};
  let audio = null;

  const state = {
    index: 0,
    playing: false,
    minimized: false,
    listOpen: false,
    volume: 0.7,
    muted: false,
    pos: null,
    time: 0,
  };

  const failed = {};
  let seeking = false;
  /** 用户是否已经交互过：未交互前的加载失败只提示，不弹窗、不自动跳歌 */
  let interacted = false;

  /* ------------------------- 持久化 ------------------------- */

  function persist() {
    App.util.store.set(App.config.storageKeys.player, {
      index: state.index,
      volume: state.volume,
      muted: state.muted,
      minimized: state.minimized,
      listOpen: state.listOpen,
      pos: state.pos,
      time: audio && Number.isFinite(audio.currentTime) ? audio.currentTime : state.time,
    });
  }

  function restore() {
    const saved = App.util.store.get(App.config.storageKeys.player, null);
    if (!saved || typeof saved !== 'object') return;
    const tracks = App.config.tracks;
    state.index = App.util.clamp(Number(saved.index) || 0, 0, Math.max(0, tracks.length - 1));
    state.volume = App.util.clamp(Number.isFinite(Number(saved.volume)) ? Number(saved.volume) : 0.7, 0, 1);
    state.muted = !!saved.muted;
    state.minimized = !!saved.minimized;
    state.listOpen = !!saved.listOpen;
    state.pos =
      saved.pos && Number.isFinite(saved.pos.x) && Number.isFinite(saved.pos.y) ? saved.pos : null;
    state.time = Number(saved.time) || 0;
  }

  /* ------------------------- 界面刷新 ------------------------- */

  function setStatus(text, isError) {
    if (!els.status) return;
    els.status.textContent = text;
    els.status.classList.toggle('is-error', !!isError);
  }

  function setPlayingUI(playing) {
    state.playing = playing;
    els.root.classList.toggle('is-playing', playing);
    els.toggle.setAttribute('aria-label', playing ? '暂停' : '播放');
    els.toggleIcon.innerHTML = playing
      ? '<path d="M7 5h3.6v14H7zM13.4 5H17v14h-3.6z"></path>'
      : '<path d="M7 4.5l13 7.5-13 7.5z"></path>';
  }

  const fillRange = (input, ratio) => {
    input.style.setProperty('--fill', `${(ratio * 100).toFixed(2)}%`);
  };

  function renderTrack() {
    const track = App.config.tracks[state.index];
    els.title.textContent = track ? track.title : '未选择曲目';
    els.artist.textContent = track ? track.artist : '—';
    els.index.textContent = App.util.idx(state.index + 1);
    els.headTitle.textContent = track ? track.title : '待机';
    document.title = track && state.playing ? `${track.title} · ${App.config.blog}` : `${App.config.blog} · SF-001`;

    App.util.$$('#plList .player__item').forEach((li, i) => {
      li.classList.toggle('is-active', i === state.index);
      const btn = App.util.$('button', li);
      if (btn) btn.setAttribute('aria-current', i === state.index ? 'true' : 'false');
    });
  }

  function renderList() {
    els.list.innerHTML = App.config.tracks
      .map(
        (track, i) => `
        <li class="player__item" data-i="${i}">
          <button type="button" aria-current="false">
            <span class="n mono">${App.util.idx(i + 1)}</span>
            <span class="t">${App.util.escapeHtml(track.title)}</span>
            <span class="a mono">${App.util.escapeHtml(track.artist)}</span>
          </button>
        </li>`
      )
      .join('');
  }

  function applyVolumeUI() {
    els.vol.value = String(Math.round(state.volume * 100));
    fillRange(els.vol, state.volume);
    const muted = state.muted || state.volume === 0;
    els.mute.setAttribute('aria-label', muted ? '取消静音' : '静音');
    els.mute.innerHTML = muted
      ? '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M4 9h3.5L12 5v14l-4.5-4H4z"></path><path d="M16 9.5l5 5m0-5l-5 5" stroke="currentColor" stroke-width="2" fill="none"></path></svg>'
      : '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M4 9h3.5L12 5v14l-4.5-4H4z"></path><path d="M15.5 9.2a4 4 0 010 5.6l1.2 1.2a5.7 5.7 0 000-8z"></path></svg>';
  }

  /* ------------------------- 播放控制 ------------------------- */

  function loadTrack(index, options) {
    const opts = options || {};
    const tracks = App.config.tracks;
    if (!tracks.length) return;

    const total = tracks.length;
    let i = ((index % total) + total) % total;
    // 跳过已知失效的曲目（最多绕一圈）
    let guard = 0;
    while (failed[i] && guard < total) {
      i = (i + 1) % total;
      guard += 1;
    }
    state.index = i;

    const track = tracks[i];
    audio.src = track.src;
    audio.load();
    renderTrack();

    const pending = opts.restoreTime ? state.time : 0;
    if (pending > 0) {
      const applyTime = () => {
        try {
          audio.currentTime = Math.min(pending, (audio.duration || pending) - 0.2);
        } catch (err) {
          /* ignore */
        }
        audio.removeEventListener('loadedmetadata', applyTime);
      };
      audio.addEventListener('loadedmetadata', applyTime);
    }

    if (opts.autoplay) play();
    else setStatus(`已就绪 · ${track.title}（${App.util.idx(i + 1)}/${total}）`);
  }

  function play() {
    interacted = true;
    const promise = audio.play();
    if (promise && typeof promise.catch === 'function') {
      promise.catch((err) => {
        setPlayingUI(false);
        setStatus(`无法播放：${err && err.message ? err.message : '浏览器拦截或音频不可用'}`, true);
        App.util.toast('error', '音频播放失败，可能是网络或浏览器自动播放限制。可点击歌单换一首试试。', { title: '播放器' });
      });
    }
  }

  function pause() {
    audio.pause();
  }

  function toggle() {
    interacted = true;
    if (audio.paused) play();
    else pause();
  }

  function next(auto) {
    interacted = true;
    const wasPlaying = state.playing || auto;
    loadTrack(state.index + 1, { autoplay: wasPlaying });
    if (!wasPlaying) setStatus('已切换到下一首（未播放）');
  }

  function prev() {
    interacted = true;
    if (audio.currentTime > 3) {
      audio.currentTime = 0;
      setStatus('已回到开头');
      return;
    }
    const wasPlaying = state.playing;
    loadTrack(state.index - 1, { autoplay: wasPlaying });
  }

  function seekBy(delta) {
    if (!Number.isFinite(audio.duration)) return;
    audio.currentTime = App.util.clamp(audio.currentTime + delta, 0, audio.duration);
  }

  /* ------------------------- 拖动 ------------------------- */

  function applyPosition() {
    if (!state.pos || App.util.isMobile()) return;
    const w = els.root.offsetWidth || 336;
    const h = els.root.offsetHeight || 220;
    const x = App.util.clamp(state.pos.x, 4, Math.max(4, window.innerWidth - w - 4));
    const y = App.util.clamp(state.pos.y, 4, Math.max(4, window.innerHeight - h - 4));
    els.root.style.left = `${x}px`;
    els.root.style.top = `${y}px`;
    els.root.style.right = 'auto';
    els.root.style.bottom = 'auto';
  }

  function bindDrag() {
    const head = els.head;
    let dragging = false;
    let start = null;

    head.addEventListener('pointerdown', (e) => {
      if (App.util.isMobile()) return;
      if (e.target.closest('button')) return;
      dragging = true;
      const rect = els.root.getBoundingClientRect();
      start = { x: e.clientX, y: e.clientY, left: rect.left, top: rect.top };
      els.root.classList.add('is-dragging');
      els.root.style.left = `${rect.left}px`;
      els.root.style.top = `${rect.top}px`;
      els.root.style.right = 'auto';
      els.root.style.bottom = 'auto';
      try {
        head.setPointerCapture(e.pointerId);
      } catch (err) {
        /* ignore */
      }
      e.preventDefault();
    });

    head.addEventListener('pointermove', (e) => {
      if (!dragging || !start) return;
      const w = els.root.offsetWidth;
      const h = els.root.offsetHeight;
      const x = App.util.clamp(start.left + (e.clientX - start.x), 4, Math.max(4, window.innerWidth - w - 4));
      const y = App.util.clamp(start.top + (e.clientY - start.y), 4, Math.max(4, window.innerHeight - h - 4));
      els.root.style.left = `${x}px`;
      els.root.style.top = `${y}px`;
      state.pos = { x, y };
    });

    const end = (e) => {
      if (!dragging) return;
      dragging = false;
      start = null;
      els.root.classList.remove('is-dragging');
      try {
        head.releasePointerCapture(e.pointerId);
      } catch (err) {
        /* ignore */
      }
      persist();
    };
    head.addEventListener('pointerup', end);
    head.addEventListener('pointercancel', end);
  }

  /* ------------------------- 事件绑定 ------------------------- */

  function bind() {
    App.util.on(els.toggle, 'click', toggle);
    App.util.on(els.prev, 'click', prev);
    App.util.on(els.next, 'click', () => next(false));

    App.util.on(els.seek, 'input', () => {
      seeking = true;
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        const ratio = Number(els.seek.value) / 1000;
        audio.currentTime = ratio * audio.duration;
        els.cur.textContent = App.util.formatTime(audio.currentTime);
        fillRange(els.seek, ratio);
      }
      seeking = false;
    });

    App.util.on(els.vol, 'input', () => {
      state.volume = App.util.clamp(Number(els.vol.value) / 100, 0, 1);
      state.muted = false;
      audio.muted = false;
      audio.volume = state.volume;
      applyVolumeUI();
      persist();
    });

    App.util.on(els.mute, 'click', () => {
      state.muted = !state.muted;
      audio.muted = state.muted;
      applyVolumeUI();
      setStatus(state.muted ? '已静音' : '已取消静音');
      persist();
    });

    App.util.on(els.minBtn, 'click', () => {
      state.minimized = !state.minimized;
      els.root.classList.toggle('is-min', state.minimized);
      els.minBtn.setAttribute('aria-expanded', String(!state.minimized));
      setStatus(state.minimized ? '播放器已最小化（点击标题栏右侧按钮展开）' : '播放器已展开');
      persist();
    });

    App.util.on(els.listToggle, 'click', () => {
      state.listOpen = !state.listOpen;
      els.list.hidden = !state.listOpen;
      els.listToggle.setAttribute('aria-expanded', String(state.listOpen));
      persist();
    });

    App.util.on(els.list, 'click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      const li = btn.closest('.player__item');
      const i = Number(li.dataset.i);
      delete failed[i];
      loadTrack(i, { autoplay: true });
    });

    // ---- audio 事件 ----
    App.util.on(audio, 'loadedmetadata', () => {
      els.dur.textContent = App.util.formatTime(audio.duration);
      setStatus(`已就绪 · ${App.config.tracks[state.index].title} · ${App.util.formatTime(audio.duration)}`);
    });
    App.util.on(audio, 'durationchange', () => {
      els.dur.textContent = App.util.formatTime(audio.duration);
    });
    App.util.on(audio, 'timeupdate', () => {
      if (!seeking && Number.isFinite(audio.duration) && audio.duration > 0) {
        const ratio = audio.currentTime / audio.duration;
        els.seek.value = String(Math.round(ratio * 1000));
        fillRange(els.seek, ratio);
      }
      els.cur.textContent = App.util.formatTime(audio.currentTime);
      state.time = audio.currentTime;
    });
    App.util.on(audio, 'play', () => {
      setPlayingUI(true);
      setStatus(`正在播放 · ${App.config.tracks[state.index].title}`);
      renderTrack();
    });
    App.util.on(audio, 'pause', () => {
      setPlayingUI(false);
      if (!audio.ended) setStatus(`已暂停 · ${App.config.tracks[state.index].title}`);
      renderTrack();
    });
    App.util.on(audio, 'waiting', () => setStatus('缓冲中…'));
    App.util.on(audio, 'ended', () => next(true));
    App.util.on(audio, 'error', () => {
      const track = App.config.tracks[state.index];
      failed[state.index] = true;
      setPlayingUI(false);
      // 用户还没点过播放：只提示，不弹窗、不自动跳歌（常见于离线状态）
      if (!interacted) {
        setStatus('音频待机（离线或链接不可用），点击播放按钮重试', true);
        return;
      }
      setStatus(`音频加载失败：${track ? track.title : '未知曲目'}（已自动跳过）`, true);
      App.util.toast('error', `曲目「${track ? track.title : '未知'}」加载失败，已切换到下一首。`, { title: '播放器' });
      if (Object.keys(failed).length < App.config.tracks.length) {
        setTimeout(() => next(true), 400);
      }
    });

    // ---- 全局快捷键（仅在主站生效，避免与入场页滚动/进入冲突） ----
    document.addEventListener('keydown', (e) => {
      if (document.body.dataset.view !== 'site') return;
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable) return;

      if (e.key === ' ' || e.code === 'Space') {
        if (e.target.closest('button, a')) return;
        e.preventDefault();
        toggle();
      } else if (e.key === 'ArrowRight' && !e.target.closest('button, a')) {
        next(false);
      } else if (e.key === 'ArrowLeft' && !e.target.closest('button, a')) {
        prev();
      }
    });

    window.addEventListener('beforeunload', persist);
    window.addEventListener('resize', App.util.debounce(() => applyPosition(), 200));

    // 页面被隐藏时保存进度
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) persist();
    });
  }

  /* ------------------------- 初始化 ------------------------- */

  function init() {
    els.root = document.getElementById('player');
    if (!els.root) return;

    els.head = document.getElementById('playerHead');
    els.body = document.getElementById('playerBody');
    els.title = document.getElementById('plTitle');
    els.artist = document.getElementById('plArtist');
    els.index = document.getElementById('plIndex');
    els.headTitle = document.getElementById('plHeadTitle');
    els.seek = document.getElementById('plSeek');
    els.cur = document.getElementById('plCur');
    els.dur = document.getElementById('plDur');
    els.prev = document.getElementById('plPrev');
    els.next = document.getElementById('plNext');
    els.toggle = document.getElementById('plToggle');
    els.toggleIcon = document.getElementById('plToggleIcon');
    els.vol = document.getElementById('plVol');
    els.mute = document.getElementById('plMute');
    els.list = document.getElementById('plList');
    els.listToggle = document.getElementById('plListToggle');
    els.minBtn = document.getElementById('plMin');
    els.status = document.getElementById('plStatus');
    els.viz = document.getElementById('plViz');
    audio = document.getElementById('audio');

    audio.preload = 'metadata';
    audio.volume = state.volume;
    audio.muted = state.muted;

    restore();

    audio.volume = state.volume;
    audio.muted = state.muted;
    els.root.classList.toggle('is-min', state.minimized);
    els.minBtn.setAttribute('aria-expanded', String(!state.minimized));
    els.list.hidden = !state.listOpen;
    els.listToggle.setAttribute('aria-expanded', String(state.listOpen));

    renderList();
    applyVolumeUI();
    renderTrack();
    setPlayingUI(false);
    bind();
    bindDrag();

    // 只预载元数据，绝不自动播放
    loadTrack(state.index, { autoplay: false, restoreTime: state.time > 1 });
    setStatus('待机 · 点击播放按钮开始（不会自动播放）');

    // 首帧后再定位，保证 offsetWidth/Height 正确
    requestAnimationFrame(() => applyPosition());
  }

  return {
    init,
    toggle,
    next,
    prev,
    get index() {
      return state.index;
    },
    get playing() {
      return state.playing;
    },
  };
})();
