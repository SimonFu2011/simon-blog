/* ==========================================================================
   app.js —— 启动引导
   页面打开后始终先停留在入场页；刷新同样回到入场页。
   ========================================================================== */
'use strict';

(function () {
  function startClocks() {
    const statusClock = document.getElementById('statusClock');
    const sysClock = document.getElementById('sysClock');
    const pad = (n) => String(n).padStart(2, '0');
    const tick = () => {
      const d = new Date();
      const text = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
      if (statusClock) statusClock.textContent = text;
      if (sysClock) sysClock.textContent = text;
    };
    tick();
    setInterval(tick, 1000);
  }

  function warnIfFileProtocol() {
    if (location.protocol !== 'file:') return;
    App.util.toast(
      'error',
      '检测到 file:// 打开方式：页面样式可用，但文章接口不可用。请运行 npm install && npm start，然后访问 http://127.0.0.1:3000',
      { title: '部署提示', duration: 15000 }
    );
  }

  function boot() {
    // 1. 视图状态：永远从入场页开始
    App.transition.boot();

    // 2. 背景视差 + 模块 3D 倾斜
    App.parallax.init();

    // 3. 音乐播放器（独立浮窗，切页不中断）
    App.player.init();

    // 4. 入场页交互
    App.landing.init();

    // 5. 文章系统（后台预加载，进入主站时已是就绪状态）
    App.posts.init();

    // 6. 时钟 / 角标
    startClocks();
    warnIfFileProtocol();

    // 7. 顶栏「封面」按钮：返回入场页，音乐继续播放
    const coverBtn = document.getElementById('coverBtn');
    App.util.on(coverBtn, 'click', () => App.transition.toLanding());

    // 8. 窗口尺寸变化：从移动端切回桌面端时重新校正播放器位置
    window.addEventListener(
      'resize',
      App.util.debounce(() => {
        document.documentElement.style.setProperty('--vw', `${window.innerWidth}px`);
      }, 200)
    );

    console.info(
      `%c SF-001 %c ${App.config.blog} 已就绪 · 入场页模式 · 向下滚动进入主站`,
      'background:#C4552E;color:#180C07;font-weight:700',
      'color:#A79B7E'
    );
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
