/* ==========================================================================
   transition.js —— 入场转场编排（总时长 < 1.2s）
   顺序：扫描线扫过 → 入场页碎片飞散 → 三栏错位滑入 → 主标题乱码 0.6s 后恢复
   ========================================================================== */
'use strict';

App.transition = (function () {
  let busy = false;
  /** 转场定时器登记表：新的转场会取消上一次未完成的收尾工作 */
  let timers = [];

  const cfg = () => App.config.transition;
  const body = () => document.body;
  const el = (id) => document.getElementById(id);

  const later = (fn, ms) => {
    const id = setTimeout(fn, ms);
    timers.push(id);
    return id;
  };

  const clearTimers = () => {
    timers.forEach((id) => clearTimeout(id));
    timers = [];
  };

  /* ------------------------- 基础动效 ------------------------- */

  function playSweep(duration) {
    const sweep = el('sweep');
    if (!sweep) return;
    sweep.style.setProperty('--sweep-dur', `${duration}ms`);
    sweep.classList.remove('is-on');
    void sweep.offsetWidth;
    sweep.classList.add('is-on');
    setTimeout(() => sweep.classList.remove('is-on'), duration + 80);
  }

  function playFlash() {
    const flash = el('flash');
    if (!flash) return;
    flash.classList.remove('is-on');
    void flash.offsetWidth;
    flash.classList.add('is-on');
  }

  const isSimple = () => App.util.isMobile() || App.util.prefersReducedMotion();

  function focusSite() {
    const brand = el('siteBrand');
    if (!brand) return;
    brand.setAttribute('tabindex', '-1');
    brand.focus({ preventScroll: true });
    setTimeout(() => brand.removeAttribute('tabindex'), 600);
  }

  /* ------------------------- 入场 → 主站 ------------------------- */

  function toSite(trigger) {
    if (body().dataset.view === 'site') return Promise.resolve(false);

    clearTimers();
    busy = true;
    const t = cfg();
    const simple = isSimple();
    const landing = el('landing');
    const site = el('site');
    const brand = el('siteBrand');

    // 复位可能残留的状态（例如上一次「返回封面」的动画尚未收尾）
    landing.classList.remove('is-returning', 'is-fading');
    site.classList.remove('is-leaving', 'is-entering', 'is-simple');

    body().dataset.view = 'site';
    body().dataset.transition = trigger || 'manual';
    body().classList.add('is-transitioning');

    // ---- 1. 扫描线从上到下扫过全屏 ----
    playSweep(t.sweep);

    // ---- 2. 入场页碎片向四周飞散 ----
    if (simple) {
      later(() => landing.classList.add('is-fading'), Math.max(40, t.flyStart));
    } else {
      App.util.$$('[data-fly]', landing).forEach((node) => {
        node.style.setProperty('--fx', node.dataset.flyX || 0);
        node.style.setProperty('--fy', node.dataset.flyY || 0);
        node.style.setProperty('--frot', node.dataset.flyRot || 0);
      });
      later(() => landing.classList.add('is-flying'), t.flyStart);
    }

    // ---- 3. 主站三栏从不同方向错位滑入 ----
    const colAt = simple ? Math.max(200, t.colStart - 90) : t.colStart;
    const colDur = simple ? t.simpleColDur : t.colDur;
    const stagger = simple ? 0 : t.colStagger;

    later(() => {
      site.hidden = false;
      site.classList.add('is-live', 'is-entering');
      if (simple) site.classList.add('is-simple');
      site.style.setProperty('--col-dur', `${colDur}ms`);
      site.style.setProperty('--d1', '0ms');
      site.style.setProperty('--d2', `${stagger}ms`);
      site.style.setProperty('--d3', `${stagger * 2}ms`);
      body().classList.remove('is-landing');
      body().classList.add('is-site');
      window.scrollTo(0, 0);
    }, colAt);

    // ---- 4. 主标题先乱码 0.6s 再恢复正常 ----
    later(() => {
      App.scramble.run(brand, { duration: t.scrambleDur });
    }, t.scrambleStart);

    // ---- 收尾 ----
    const columnsEnd = colAt + colDur + stagger * 2;
    const scrambleEnd = t.scrambleStart + t.scrambleDur;
    const total = Math.min(Math.max(columnsEnd, scrambleEnd) + 40, t.total);

    return new Promise((resolve) => {
      later(() => {
        site.classList.remove('is-entering', 'is-simple');
        landing.classList.add('is-gone');
        landing.classList.remove('is-flying', 'is-fading');
        body().classList.remove('is-transitioning');
        focusSite();
        busy = false;
        resolve(true);
      }, total);
    });
  }

  /* ------------------------- 主站 → 入场页（音乐不中断） ------------------------- */

  function toLanding() {
    if (body().dataset.view === 'landing') return Promise.resolve(false);

    clearTimers();
    busy = true;
    const t = cfg();
    const landing = el('landing');
    const site = el('site');

    // 复位可能残留的状态（例如入场动画尚未播完就点了「封面」）
    site.classList.remove('is-entering', 'is-simple');
    landing.classList.remove('is-flying', 'is-fading', 'is-returning');

    body().dataset.view = 'landing';
    body().classList.add('is-transitioning');
    playSweep(Math.max(240, t.sweep - 80));
    site.classList.add('is-leaving');

    // 播放器是 #site 之外的独立浮窗，因此音频完全不受影响
    const outDur = App.util.prefersReducedMotion() ? 60 : 300;

    return new Promise((resolve) => {
      later(() => {
        site.hidden = true;
        site.classList.remove('is-live', 'is-leaving', 'is-entering', 'is-simple');
        site.style.removeProperty('--col-dur');
        landing.classList.remove('is-gone', 'is-flying', 'is-fading');
        landing.classList.add('is-returning');
        body().classList.remove('is-site');
        body().classList.add('is-landing');
        window.scrollTo(0, 0);
        App.landing.reset();
      }, outDur);

      later(() => {
        landing.classList.remove('is-returning');
        body().classList.remove('is-transitioning');
        busy = false;
        resolve(true);
      }, outDur + 460);
    });
  }

  /** 首次进入页面：确保处于入场页状态
   *  调试用：访问 ?view=site 可直接进入主站（跳过入场页，方便截图/排查） */
  function boot() {
    const landing = el('landing');
    const site = el('site');
    if (!landing || !site) return;
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

    const debugSite = new URLSearchParams(location.search).get('view') === 'site';
    if (debugSite) {
      body().dataset.view = 'site';
      landing.classList.add('is-gone');
      site.hidden = false;
      site.classList.add('is-live');
      body().classList.remove('is-landing');
      body().classList.add('is-site');
      window.scrollTo(0, 0);
      return;
    }

    body().dataset.view = 'landing';
    site.hidden = true;
    site.classList.remove('is-live', 'is-entering', 'is-leaving', 'is-simple');
    landing.classList.remove('is-gone', 'is-flying', 'is-fading', 'is-returning');
    body().classList.add('is-landing');
    body().classList.remove('is-site', 'is-transitioning');
    window.scrollTo(0, 0);
  }

  return {
    boot,
    toSite,
    toLanding,
    get busy() {
      return busy;
    },
  };
})();
