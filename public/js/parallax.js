/* ==========================================================================
   parallax.js —— 背景视差 + 模块 3D 倾斜
   ========================================================================== */
'use strict';

App.parallax = (function () {
  const root = () => document.documentElement;

  /* ------------------------- 背景视差 ------------------------- */

  function initBackground() {
    const bgfx = document.getElementById('bgfx');
    if (!bgfx) return;

    // 每一层的位移系数（px）
    App.util.$$('[data-depth]', bgfx).forEach((layer) => {
      layer.style.setProperty('--d', layer.dataset.depth || 10);
    });

    if (App.util.prefersReducedMotion() || App.util.isTouch()) return;

    const apply = App.util.rafThrottle((x, y) => {
      root().style.setProperty('--px', x.toFixed(4));
      root().style.setProperty('--py', y.toFixed(4));
    });

    window.addEventListener(
      'mousemove',
      (e) => {
        const x = (e.clientX / window.innerWidth) * 2 - 1;
        const y = (e.clientY / window.innerHeight) * 2 - 1;
        apply(x, y);
      },
      { passive: true }
    );

    window.addEventListener(
      'mouseleave',
      () => {
        root().style.setProperty('--px', '0');
        root().style.setProperty('--py', '0');
      },
      { passive: true }
    );
  }

  /* ------------------------- 模块 3D 倾斜 ------------------------- */

  function attachTilt(el, strength) {
    if (!el || el.dataset.tiltBound === '1') return;
    el.dataset.tiltBound = '1';
    if (App.util.prefersReducedMotion() || App.util.isTouch()) return;

    const max = strength || 4;
    let raf = null;
    let pending = null;

    const paint = () => {
      raf = null;
      if (!pending) return;
      el.style.setProperty('--ry', `${pending.x.toFixed(2)}deg`);
      el.style.setProperty('--rx', `${pending.y.toFixed(2)}deg`);
    };

    el.addEventListener(
      'pointermove',
      (e) => {
        const rect = el.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const y = ((e.clientY - rect.top) / rect.height) * 2 - 1;
        pending = { x: App.util.clamp(x * max, -max, max), y: App.util.clamp(-y * max, -max, max) };
        if (!raf) raf = requestAnimationFrame(paint);
      },
      { passive: true }
    );

    el.addEventListener('pointerleave', () => {
      pending = null;
      el.style.removeProperty('--rx');
      el.style.removeProperty('--ry');
    });
  }

  function initTilt() {
    App.util.$$('.tilt').forEach((el) => attachTilt(el));
  }

  function init() {
    initBackground();
    initTilt();
  }

  return { init, attachTilt };
})();
