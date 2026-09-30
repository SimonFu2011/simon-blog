/* ==========================================================================
   posts.js —— 文章系统：列表 / 摘要展开 / 标签筛选 / 检索 / 发布 / 编辑 / 删除
   ========================================================================== */
'use strict';

App.posts = (function () {
  const state = {
    items: [],
    tags: [],
    stats: null,
    total: 0,
    filter: { tag: null, q: '' },
    detail: new Map(),
    editing: null,
    pendingDelete: null,
    composerTags: new Set(),
    loading: false,
  };

  const els = {};

  /* ------------------------- DOM 缓存 ------------------------- */

  function cacheEls() {
    els.stream = document.getElementById('stream');
    els.streamState = document.getElementById('streamState');
    els.streamTitle = document.getElementById('streamTitle');
    els.streamCount = document.getElementById('streamCount');
    els.streamFilter = document.getElementById('streamFilter');
    els.tagCloud = document.getElementById('tagCloud');
    els.tagReset = document.getElementById('tagReset');
    els.search = document.getElementById('searchInput');
    els.newPostBtn = document.getElementById('newPostBtn');
    els.refreshBtn = document.getElementById('refreshBtn');
    els.siteBrand = document.getElementById('siteBrand');

    els.statPosts = document.getElementById('statPosts');
    els.statChars = document.getElementById('statChars');
    els.statTags = document.getElementById('statTags');
    els.statLatest = document.getElementById('statLatest');
    els.tagBars = document.getElementById('tagBars');
    els.yearBars = document.getElementById('yearBars');
    els.factPosts = document.getElementById('factPosts');
    els.sysApi = document.getElementById('sysApi');
    els.statusText = document.getElementById('statusText');
    els.footYear = document.getElementById('footYear');

    els.dialog = document.getElementById('composerDialog');
    els.form = document.getElementById('composerForm');
    els.composerNum = document.getElementById('composerNum');
    els.composerTitle = document.getElementById('composerTitle');
    els.composerSubmit = document.getElementById('composerSubmit');
    els.composerCancel = document.getElementById('composerCancel');
    els.composerClose = document.getElementById('composerClose');
    els.fTitle = document.getElementById('fTitle');
    els.fBody = document.getElementById('fBody');
    els.fTags = document.getElementById('fTags');
    els.fCount = document.getElementById('fCount');
    els.composerError = document.getElementById('composerError');

    els.confirmDialog = document.getElementById('confirmDialog');
    els.confirmTarget = document.getElementById('confirmTarget');
    els.confirmOk = document.getElementById('confirmOk');
    els.confirmCancel = document.getElementById('confirmCancel');
  }

  /* ------------------------- 渲染：文章流 ------------------------- */

  const tagChipHtml = (tag, active) => `
    <button type="button" class="chip" data-tag="${App.util.escapeHtml(tag.name)}"
            style="--chip-color:${tag.color}" aria-pressed="${active ? 'true' : 'false'}"
            title="筛选标签：${App.util.escapeHtml(tag.name)}">
      <span class="chip__dot"></span>
      <span class="chip__label">${App.util.escapeHtml(tag.name)}</span>
      ${tag.count !== undefined ? `<span class="chip__count">${tag.count}</span>` : ''}
    </button>`;

  function cardHtml(post, i) {
    const accent = post.tags && post.tags.length ? post.tags[0].color : '#8A8F6A';
    const author = (post.author && post.author.name) || App.config.author;
    const tags = (post.tags || []).map((t) => tagChipHtml(t, state.filter.tag === t.name)).join('');
    const excerpt = App.util.escapeHtml(post.excerpt || '');
    const title = App.util.highlight(post.title, state.filter.q);

    return `
      <article class="post" data-id="${post.id}" style="--accent:${accent}">
        <header class="post__head">
          <span class="post__idx mono" aria-hidden="true">${App.util.idx(i + 1)}</span>
          <h3 class="post__title">
            <button type="button" class="post__toggle" aria-expanded="false" aria-controls="pbody-${post.id}">
              ${title}
            </button>
          </h3>
          <span class="post__date mono" title="${App.util.formatDateTime(post.createdAt)}">${App.util.formatDate(post.createdAt)}</span>
        </header>
        <div class="post__meta">
          <span class="post__author mono">BY ${App.util.escapeHtml(author)}</span>
          <span class="post__dot" aria-hidden="true">◆</span>
          <span class="post__tags">${tags}</span>
        </div>
        <div class="post__body" id="pbody-${post.id}">
          <p class="post__excerpt">${excerpt}</p>
          <div class="post__full"></div>
        </div>
        <footer class="post__foot">
          <button type="button" class="post__more">展开全文</button>
          <span class="post__len mono">${post.bodyLength || 0} 字</span>
          <span class="spacer"></span>
          <button type="button" class="post__edit" aria-label="编辑《${App.util.escapeHtml(post.title)}》">编辑</button>
          <button type="button" class="post__del" aria-label="删除《${App.util.escapeHtml(post.title)}》">删除</button>
        </footer>
      </article>`;
  }

  function renderStream() {
    els.streamState.hidden = true;
    els.streamState.innerHTML = '';
    els.stream.setAttribute('aria-busy', 'false');

    if (!state.items.length) {
      const filtered = state.filter.tag || state.filter.q;
      els.stream.innerHTML = `
        <div class="emptybox">
          <div class="emptybox__hex" aria-hidden="true"></div>
          <p class="emptybox__title">${filtered ? '没有符合条件的文章' : '档案库为空'}</p>
          <p class="emptybox__msg">${
            filtered
              ? `当前筛选：${App.util.escapeHtml(state.filter.tag || '')}${state.filter.q ? ` 检索词「${App.util.escapeHtml(state.filter.q)}」` : ''}`
              : '点击右上角「新帖」写下第一篇。'
          }</p>
        </div>`;
      updateStreamBar();
      return;
    }

    els.stream.innerHTML = state.items.map(cardHtml).join('');
    App.util.$$('.post', els.stream).forEach((card) => App.parallax.attachTilt(card, 2.4));
    updateStreamBar();
  }

  function updateStreamBar() {
    const { tag, q } = state.filter;
    els.streamTitle.textContent = tag ? `标签：${tag}` : q ? `检索：${q}` : '全部文章';
    els.streamCount.textContent = `显示 ${state.items.length} / 共 ${state.total} 篇`;
    if (tag || q) {
      els.streamFilter.hidden = false;
      els.streamFilter.textContent = tag ? `TAG ▸ ${tag}` : `QUERY ▸ ${q}`;
    } else {
      els.streamFilter.hidden = true;
      els.streamFilter.textContent = '';
    }
    if (els.tagReset) els.tagReset.hidden = !tag;
  }

  function showStreamError(err) {
    els.stream.innerHTML = '';
    els.stream.setAttribute('aria-busy', 'false');
    els.streamState.hidden = false;
    els.streamState.innerHTML = `
      <div class="errbox" role="alert">
        <p class="errbox__title">数据加载失败</p>
        <p class="errbox__msg">${App.util.escapeHtml(err.message || '未知错误')}</p>
        <div class="errbox__actions">
          <button type="button" class="btn btn--accent" id="streamRetry">重新加载</button>
        </div>
      </div>`;
    const retry = document.getElementById('streamRetry');
    App.util.on(retry, 'click', () => refreshAll({ toastOnSuccess: true }));
    updateStreamBar();
  }

  function renderSkeleton() {
    els.streamState.hidden = true;
    els.stream.setAttribute('aria-busy', 'true');
    els.stream.innerHTML = `
      <article class="post post--skeleton" aria-hidden="true">
        <div class="skeleton skeleton--line skeleton--title"></div>
        <div class="skeleton skeleton--line"></div>
        <div class="skeleton skeleton--line"></div>
        <div class="skeleton skeleton--line skeleton--short"></div>
      </article>
      <article class="post post--skeleton" aria-hidden="true">
        <div class="skeleton skeleton--line skeleton--title"></div>
        <div class="skeleton skeleton--line"></div>
        <div class="skeleton skeleton--line skeleton--short"></div>
      </article>`;
  }

  /* ------------------------- 渲染：标签云 ------------------------- */

  function renderTags() {
    if (!els.tagCloud) return;
    // 重建标签云会换掉 DOM 节点，这里把键盘焦点交还给同一个标签
    const active = document.activeElement;
    const focusedTag =
      active && active.classList && active.classList.contains('chip') ? active.dataset.tag : null;

    els.tagCloud.innerHTML = state.tags.map((tag) => tagChipHtml(tag, state.filter.tag === tag.name)).join('');
    if (els.tagReset) els.tagReset.hidden = !state.filter.tag;

    if (focusedTag) {
      const next = App.util.$$('.chip[data-tag]', els.tagCloud).find((c) => c.dataset.tag === focusedTag);
      if (next) next.focus({ preventScroll: true });
    }
  }

  /* ------------------------- 渲染：统计 ------------------------- */

  const formatNumber = (n) => Number(n || 0).toLocaleString('zh-CN');

  function renderStats() {
    const s = state.stats;
    if (!s) return;
    els.statPosts.textContent = formatNumber(s.postCount);
    els.statChars.textContent = formatNumber(s.charCount);
    els.statTags.textContent = formatNumber(s.tagCount);
    els.statLatest.textContent = App.util.formatDate(s.latestAt);
    els.factPosts.textContent = `${s.postCount} 篇文章在库`;

    const max = Math.max(1, ...(s.topTags || []).map((t) => t.count));
    els.tagBars.innerHTML = (s.topTags || [])
      .map(
        (t) => `
        <div class="bar">
          <span class="bar__label">${App.util.escapeHtml(t.name)}</span>
          <span class="bar__track"><i style="--c:${t.color}" data-w="${Math.round((t.count / max) * 100)}"></i></span>
          <span class="bar__val mono">${t.count}</span>
        </div>`
      )
      .join('');

    els.yearBars.innerHTML = (s.byYear || [])
      .map(
        (y) => `
        <div class="years__row">
          <span class="years__year mono">${App.util.escapeHtml(y.year)}</span>
          <span class="years__pips">${'<i></i>'.repeat(Math.min(y.count, 12))}</span>
          <span class="years__count mono">${y.count}</span>
        </div>`
      )
      .join('');

    // 触发进度条动画
    requestAnimationFrame(() => {
      App.util.$$('.bar__track i', els.tagBars).forEach((bar) => {
        bar.style.width = `${bar.dataset.w}%`;
      });
    });

    if (els.sysApi) els.sysApi.textContent = '正常 · /api';
    if (els.statusText) {
      els.statusText.textContent = `SYSTEM ONLINE · 文章 ${s.postCount} · 标签 ${s.tagCount} · 最后同步 ${App.util.formatDateTime(new Date())}`;
    }
  }

  /* ------------------------- 数据加载 ------------------------- */

  async function refreshAll(opts) {
    const options = opts || {};
    state.loading = true;
    if (!options.silent) renderSkeleton();
    try {
      const [posts, tags, stats] = await Promise.all([
        App.api.listPosts({ tag: state.filter.tag, q: state.filter.q }),
        App.api.listTags(),
        App.api.stats(),
      ]);
      state.items = posts.items || [];
      state.total = posts.total || 0;
      state.tags = tags.items || [];
      state.stats = stats;
      renderStream();
      renderTags();
      renderStats();
      if (options.toastOnSuccess) App.util.toast('ok', '档案已重新同步。', { title: '数据' });
    } catch (err) {
      showStreamError(err);
      if (els.sysApi) els.sysApi.textContent = '连接失败';
      App.util.toast('error', err.message || '数据加载失败', { title: '接口' });
    } finally {
      state.loading = false;
    }
  }

  async function loadPosts() {
    renderSkeleton();
    try {
      const posts = await App.api.listPosts({ tag: state.filter.tag, q: state.filter.q });
      state.items = posts.items || [];
      state.total = posts.total || 0;
      renderStream();
      renderTags();
    } catch (err) {
      showStreamError(err);
    }
  }

  /* ------------------------- 展开全文 ------------------------- */

  async function toggleExpand(card, post) {
    const open = card.classList.toggle('is-open');
    const toggleBtn = App.util.$('.post__toggle', card);
    const moreBtn = App.util.$('.post__more', card);
    if (toggleBtn) toggleBtn.setAttribute('aria-expanded', String(open));
    if (moreBtn) moreBtn.textContent = open ? '收起全文' : '展开全文';
    if (!open) return;

    const full = App.util.$('.post__full', card);
    if (state.detail.has(post.id)) {
      full.innerHTML = App.util.textToParagraphs(state.detail.get(post.id).body);
      return;
    }

    full.innerHTML = `
      <div class="post__loading" aria-live="polite">
        <span class="skeleton skeleton--line"></span>
        <span class="skeleton skeleton--line"></span>
        <span class="skeleton skeleton--line skeleton--short"></span>
      </div>`;

    try {
      const detail = await App.api.getPost(post.id);
      state.detail.set(post.id, detail);
      full.innerHTML = App.util.textToParagraphs(detail.body);
    } catch (err) {
      full.innerHTML = `<p style="color:#F0B69C;font-family:var(--font-mono);font-size:12px;text-indent:0">
        正文加载失败：${App.util.escapeHtml(err.message)}</p>`;
    }
  }

  /* ------------------------- 标签筛选 / 检索 ------------------------- */

  function applyFilter(tag) {
    state.filter.tag = tag || null;
    loadPosts();
  }

  const runSearch = App.util.debounce(() => {
    const value = els.search ? els.search.value.trim() : '';
    state.filter.q = value;
    loadPosts();
  }, 320);

  /* ------------------------- 发布 / 编辑 ------------------------- */

  function renderComposerTags() {
    els.fTags.innerHTML = state.tags
      .map(
        (tag) => `
        <button type="button" class="chip" data-tag-id="${tag.id}"
                style="--chip-color:${tag.color}"
                aria-pressed="${state.composerTags.has(tag.id) ? 'true' : 'false'}">
          <span class="chip__dot"></span>
          <span class="chip__label">${App.util.escapeHtml(tag.name)}</span>
        </button>`
      )
      .join('');
  }

  function updateCount() {
    els.fCount.textContent = String(els.fBody.value.length);
  }

  function showComposerError(message) {
    els.composerError.hidden = false;
    els.composerError.textContent = message;
  }

  function clearComposerError() {
    els.composerError.hidden = true;
    els.composerError.textContent = '';
  }

  function openComposer(post) {
    state.editing = post || null;
    state.composerTags = new Set(post && post.tags ? post.tags.map((t) => t.id) : []);
    els.composerNum.textContent = post ? `#${String(post.id).padStart(3, '0')}` : 'NEW';
    els.composerTitle.textContent = post ? '编辑文章' : '撰写新帖';
    els.composerSubmit.textContent = post ? '保存修改' : '保存并发布';
    els.fTitle.value = post ? post.title : '';
    els.fBody.value = post && post.body ? post.body : '';
    clearComposerError();
    renderComposerTags();
    updateCount();
    if (!els.dialog.open) els.dialog.showModal();
    setTimeout(() => els.fTitle.focus(), 40);
  }

  async function editPost(id, trigger) {
    if (state.detail.has(id)) {
      openComposer(state.detail.get(id));
      return;
    }
    const original = trigger ? trigger.textContent : '';
    if (trigger) {
      trigger.disabled = true;
      trigger.textContent = '载入…';
    }
    try {
      const detail = await App.api.getPost(id);
      state.detail.set(id, detail);
      openComposer(detail);
    } catch (err) {
      App.util.toast('error', `无法载入文章正文：${err.message}`, { title: '编辑' });
    } finally {
      if (trigger) {
        trigger.disabled = false;
        trigger.textContent = original || '编辑';
      }
    }
  }

  async function submitComposer(event) {
    event.preventDefault();
    const title = els.fTitle.value.trim();
    const body = els.fBody.value.trim();
    const tags = Array.from(state.composerTags);

    if (!title) return showComposerError('标题不能为空。');
    if (!body) return showComposerError('正文不能为空。');

    const editing = state.editing;
    els.composerSubmit.disabled = true;
    els.composerSubmit.textContent = '保存中…';
    clearComposerError();

    try {
      if (editing) {
        const updated = await App.api.updatePost(editing.id, { title, body, tags });
        state.detail.set(updated.id, updated);
        els.dialog.close();
        App.scramble.run(els.siteBrand, { duration: App.config.transition.scrambleDur });
        await refreshAll({ silent: true });
        App.util.toast('ok', `《${updated.title}》已更新。`, { title: '编辑' });
      } else {
        const created = await App.api.createPost({ title, body, tags });
        state.detail.set(created.id, created);
        // 退出筛选，保证新帖一定出现在列表中
        const hadFilter = state.filter.tag || state.filter.q;
        state.filter.tag = null;
        state.filter.q = '';
        if (els.search) els.search.value = '';
        els.dialog.close();
        await refreshAll({ silent: true });
        highlightNew(created.id);
        App.scramble.run(els.siteBrand, { duration: App.config.transition.scrambleDur });
        App.util.toast('ok', `《${created.title}》已发布${hadFilter ? '（已退出筛选，显示全部文章）' : ''}。`, {
          title: '发布',
        });
      }
    } catch (err) {
      const extra = err.details && err.details.allowedTags ? ` 允许的标签：${err.details.allowedTags.join('、')}` : '';
      showComposerError(`${err.message}${extra}`);
    } finally {
      els.composerSubmit.disabled = false;
      els.composerSubmit.textContent = state.editing ? '保存修改' : '保存并发布';
    }
  }

  function highlightNew(id) {
    const card = App.util.$(`.post[data-id="${id}"]`, els.stream);
    if (!card) return;
    card.classList.add('is-new');
    card.scrollIntoView({ behavior: App.util.prefersReducedMotion() ? 'auto' : 'smooth', block: 'center' });
    setTimeout(() => card.classList.remove('is-new'), 900);
  }

  /* ------------------------- 删除（含确认框） ------------------------- */

  function askDelete(post) {
    return new Promise((resolve) => {
      state.pendingDelete = post;
      els.confirmTarget.textContent = `《${post.title}》`;
      els.confirmDialog.showModal();
      els.confirmCancel.focus();

      const finish = (ok) => {
        els.confirmOk.removeEventListener('click', onOk);
        els.confirmCancel.removeEventListener('click', onCancel);
        els.confirmDialog.removeEventListener('close', onClose);
        if (els.confirmDialog.open) els.confirmDialog.close();
        resolve(ok);
      };
      const onOk = () => finish(true);
      const onCancel = () => finish(false);
      const onClose = () => finish(false);

      els.confirmOk.addEventListener('click', onOk);
      els.confirmCancel.addEventListener('click', onCancel);
      els.confirmDialog.addEventListener('close', onClose);
    });
  }

  async function deleteFlow(post) {
    const ok = await askDelete(post);
    if (!ok) return;
    try {
      await App.api.deletePost(post.id);
      state.detail.delete(post.id);
      state.items = state.items.filter((p) => p.id !== post.id);
      const card = App.util.$(`.post[data-id="${post.id}"]`, els.stream);
      if (card) card.classList.add('is-removing');
      App.util.toast('ok', `《${post.title}》已删除。`, { title: '删除' });
      setTimeout(() => refreshAll({ silent: true }), 340);
    } catch (err) {
      App.util.toast('error', `删除失败：${err.message}`, { title: '删除' });
    }
  }

  /* ------------------------- 事件绑定 ------------------------- */

  function bindEvents() {
    // 文章卡片（事件委托）
    App.util.on(els.stream, 'click', (e) => {
      const card = e.target.closest('.post');
      if (!card || card.classList.contains('post--skeleton')) return;
      const id = Number(card.dataset.id);
      const post = state.items.find((p) => p.id === id);
      if (!post) return;

      if (e.target.closest('.post__toggle') || e.target.closest('.post__more')) {
        toggleExpand(card, post);
        return;
      }
      if (e.target.closest('.post__edit')) {
        editPost(id, e.target.closest('.post__edit'));
        return;
      }
      if (e.target.closest('.post__del')) {
        deleteFlow(post);
        return;
      }
      const chip = e.target.closest('.chip[data-tag]');
      if (chip) applyFilter(chip.dataset.tag);
    });

    // 标签云
    App.util.on(els.tagCloud, 'click', (e) => {
      const chip = e.target.closest('.chip[data-tag]');
      if (!chip) return;
      const tag = chip.dataset.tag;
      applyFilter(state.filter.tag === tag ? null : tag);
    });

    App.util.on(els.tagReset, 'click', () => {
      state.filter.q = '';
      if (els.search) els.search.value = '';
      applyFilter(null);
    });

    // 检索
    App.util.on(els.search, 'input', runSearch);

    // 新建
    App.util.on(els.newPostBtn, 'click', () => {
      if (!state.tags.length) {
        App.util.toast('info', '标签尚未加载完成，请稍候再试。', { title: '新帖' });
        return;
      }
      openComposer(null);
    });

    // 重新同步
    App.util.on(els.refreshBtn, 'click', () => refreshAll({ toastOnSuccess: true }));

    // 表单
    App.util.on(els.form, 'submit', submitComposer);
    App.util.on(els.fBody, 'input', updateCount);
    App.util.on(els.composerCancel, 'click', () => els.dialog.close());
    App.util.on(els.composerClose, 'click', () => els.dialog.close());
    App.util.on(els.fTags, 'click', (e) => {
      const chip = e.target.closest('.chip[data-tag-id]');
      if (!chip) return;
      const id = Number(chip.dataset.tagId);
      if (state.composerTags.has(id)) state.composerTags.delete(id);
      else state.composerTags.add(id);
      chip.setAttribute('aria-pressed', String(state.composerTags.has(id)));
    });

    // Ctrl/⌘ + Enter 保存
    App.util.on(els.form, 'keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        els.form.requestSubmit ? els.form.requestSubmit() : submitComposer(e);
      }
    });

    // 顶栏导航
    App.util.$$('.navbtn[data-goto]').forEach((btn) => {
      App.util.on(btn, 'click', () => {
        const target = document.querySelector(btn.dataset.goto);
        if (target) target.scrollIntoView({ behavior: App.util.prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
      });
    });
  }

  /* ------------------------- 初始化 ------------------------- */

  function init() {
    cacheEls();
    if (els.footYear) els.footYear.textContent = String(new Date().getFullYear());
    bindEvents();
    return refreshAll();
  }

  return {
    init,
    refreshAll,
    openComposer,
    get state() {
      return state;
    },
  };
})();
