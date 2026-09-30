/* ==========================================================================
   util.js —— DOM 工具 / 格式化 / 提示条 / 本地存储
   ========================================================================== */
'use strict';

App.util = (function () {
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.prototype.slice.call((root || document).querySelectorAll(sel));

  const on = (el, type, handler, opts) => {
    if (!el) return () => {};
    el.addEventListener(type, handler, opts);
    return () => el.removeEventListener(type, handler, opts);
  };

  const pad2 = (n) => String(n).padStart(2, '0');
  const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

  const escapeHtml = (str) =>
    String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  /** 纯文本正文 → 段落 HTML */
  const textToParagraphs = (text) =>
    String(text || '')
      .split(/\n{2,}/)
      .map((block) => block.trim())
      .filter(Boolean)
      .map((block) => `<p>${escapeHtml(block).replace(/\n/g, '<br>')}</p>`)
      .join('');

  const toDate = (value) => {
    if (!value) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  };

  /** 2026.09.30 */
  const formatDate = (value) => {
    const d = toDate(value);
    if (!d) return '—';
    return `${d.getFullYear()}.${pad2(d.getMonth() + 1)}.${pad2(d.getDate())}`;
  };

  /** 2026.09.30 22:41 */
  const formatDateTime = (value) => {
    const d = toDate(value);
    if (!d) return '—';
    return `${formatDate(d)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  };

  /** 秒 → mm:ss */
  const formatTime = (seconds) => {
    if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
    const total = Math.floor(seconds);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return h > 0 ? `${h}:${pad2(m)}:${pad2(s)}` : `${pad2(m)}:${pad2(s)}`;
  };

  const debounce = (fn, wait) => {
    let timer = null;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), wait);
    };
  };

  /** requestAnimationFrame 节流 */
  const rafThrottle = (fn) => {
    let queued = false;
    let lastArgs = null;
    return function (...args) {
      lastArgs = args;
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        fn.apply(this, lastArgs);
      });
    };
  };

  /* ------------------------- 本地存储 ------------------------- */

  const store = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem(key);
        if (raw === null) return fallback;
        return JSON.parse(raw);
      } catch (err) {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (err) {
        /* 隐私模式下忽略 */
      }
    },
    del(key) {
      try {
        localStorage.removeItem(key);
      } catch (err) {
        /* ignore */
      }
    },
  };

  /* ------------------------- 环境判断 ------------------------- */

  const mq = (query) => (window.matchMedia ? window.matchMedia(query) : { matches: false });

  const prefersReducedMotion = () => mq('(prefers-reduced-motion: reduce)').matches;
  const isMobile = () => window.innerWidth <= App.config.breakpoints.mobile;
  const isTablet = () => window.innerWidth <= App.config.breakpoints.tablet;
  const isTouch = () => mq('(hover: none)').matches || 'ontouchstart' in window;

  /* ------------------------- 提示条 ------------------------- */

  const TOAST_META = {
    ok: { kind: 'OK', tag: '操作成功' },
    error: { kind: 'ERR', tag: '发生错误' },
    info: { kind: 'SYS', tag: '系统提示' },
  };

  function toast(type, message, options) {
    const opts = options || {};
    const host = $('#toasts');
    if (!host) return;
    const meta = TOAST_META[type] || TOAST_META.info;

    const box = document.createElement('div');
    box.className = `toast toast--${type}`;
    box.setAttribute('role', type === 'error' ? 'alert' : 'status');
    box.innerHTML = `
      <div class="toast__head">
        <span class="toast__kind">${meta.kind}</span>
        <span class="toast__kind" style="color:inherit;opacity:.7">${escapeHtml(opts.title || meta.tag)}</span>
        <button type="button" class="iconbtn toast__close" aria-label="关闭提示" style="width:22px;height:22px">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3"><path d="M6 6l12 12M18 6L6 18"></path></svg>
        </button>
      </div>
      <p class="toast__msg">${escapeHtml(message)}</p>
    `;

    const close = () => {
      box.classList.add('is-out');
      setTimeout(() => box.remove(), 220);
    };
    $('.toast__close', box).addEventListener('click', close);
    host.appendChild(box);

    const life = opts.duration || (type === 'error' ? 7000 : 4200);
    const timer = setTimeout(close, life);
    box.addEventListener('mouseenter', () => clearTimeout(timer));
    return box;
  }

  /* ------------------------- 杂项 ------------------------- */

  /** 序号：1 -> "01" */
  const idx = (n) => pad2(n);

  /** 搜索高亮（仅用于标题/摘要） */
  function highlight(text, needle) {
    const safe = escapeHtml(text);
    if (!needle) return safe;
    const q = escapeHtml(needle).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    try {
      return safe.replace(new RegExp(q, 'gi'), (m) => `<mark style="background:#C4552E;color:#180C07">${m}</mark>`);
    } catch (err) {
      return safe;
    }
  }

  /** 强制重排后重放动画 */
  function replay(el, className) {
    if (!el) return;
    el.classList.remove(className);
    void el.offsetWidth;
    el.classList.add(className);
  }

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  return {
    $, $$, on, pad2, clamp, escapeHtml, textToParagraphs, highlight,
    formatDate, formatDateTime, formatTime,
    debounce, rafThrottle, store, mq,
    prefersReducedMotion, isMobile, isTablet, isTouch,
    toast, idx, replay, sleep,
  };
})();
