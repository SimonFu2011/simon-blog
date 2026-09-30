/* ==========================================================================
   landing.js —— 入场页交互
   进入主站方式：向下滚动 / 点击提示 / Enter / 空格 / 方向键↓
   ========================================================================== */
'use strict';

App.landing = (function () {
  let els = {};
  let accum = 0;
  let touchStartY = null;

  const inLanding = () => document.body.dataset.view === 'landing';

  function isTypingTarget(target) {
    if (!target || !target.closest) return false;
    return !!target.closest('input, textarea, select, [contenteditable="true"]');
  }

  /** 入场页是否已经滚到底（桌面端 overflow:hidden，恒为 true） */
  function atBottom() {
    if (!els.landing) return true;
    const el = els.landing;
    if (el.scrollHeight <= el.clientHeight + 4) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 12;
  }

  function enter(trigger) {
    if (!inLanding()) return;
    App.transition.toSite(trigger || 'manual');
  }

  function onWheel(e) {
    if (!inLanding()) return;
    if (!atBottom()) return; // 内容还能滚，先让用户看完
    if (e.deltaY <= 0) {
      accum = 0;
      return;
    }
    accum += e.deltaY;
    if (accum > 60) {
      accum = 0;
      enter('wheel');
    }
  }

  function onTouchStart(e) {
    if (!inLanding()) return;
    touchStartY = e.touches && e.touches[0] ? e.touches[0].clientY : null;
    accum = 0;
  }

  function onTouchMove(e) {
    if (!inLanding() || touchStartY === null) return;
    const y = e.touches && e.touches[0] ? e.touches[0].clientY : touchStartY;
    const dy = touchStartY - y; // 向上滑 = 正数
    if (dy <= 0 || !atBottom()) {
      accum = 0;
      return;
    }
    accum = dy;
    if (accum > 52) {
      accum = 0;
      touchStartY = null;
      enter('touch');
    }
  }

  function onKeyDown(e) {
    if (!inLanding()) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (isTypingTarget(e.target)) return;

    const key = e.key;
    const isEnter = key === 'Enter' || e.code === 'Enter' || e.code === 'NumpadEnter';
    const isSpace = key === ' ' || key === 'Spacebar' || e.code === 'Space';
    const isDown = key === 'ArrowDown' || key === 'Down' || e.code === 'ArrowDown' || key === 'PageDown';

    if (isEnter || isSpace || isDown) {
      e.preventDefault();
      enter(isEnter ? 'enter-key' : isSpace ? 'space-key' : 'arrow-down');
    }
  }

  function init() {
    els.landing = document.getElementById('landing');
    els.enterBtn = document.getElementById('enterBtn');

    App.util.on(els.enterBtn, 'click', () => enter('click'));

    window.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', () => {
      touchStartY = null;
      accum = 0;
    }, { passive: true });
    document.addEventListener('keydown', onKeyDown);
  }

  /** 返回入场页时复位 */
  function reset() {
    accum = 0;
    touchStartY = null;
    if (els.landing) els.landing.scrollTop = 0;
    const btn = els.enterBtn;
    if (btn) setTimeout(() => btn.focus({ preventScroll: true }), 320);
  }

  return { init, reset, enter };
})();
