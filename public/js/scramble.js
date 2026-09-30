/* ==========================================================================
   scramble.js —— 乱码动画（日文片假名 + 十六进制符号）
   用于：主站主标题恢复、发布新帖时的标题乱码（0.6s）
   ========================================================================== */
'use strict';

App.scramble = (function () {
  const KATAKANA =
    'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン' +
    'ガギグゲゴザジズゼゾダヂヅデドバビブベボパピプペポァィゥェォッャュョ';
  const HEX = '0123456789ABCDEF';
  const SYMBOLS = '<>/\\|_-[]{}#%&*+=:;';
  const POOL = (KATAKANA + HEX + HEX + HEX + SYMBOLS).split('');

  const tokens = new WeakMap();

  const randomGlyph = () => POOL[(Math.random() * POOL.length) | 0];

  /**
   * 让元素文字乱码后恢复
   * @param {HTMLElement} el       目标元素（建议带 data-text 属性，以同步叠印层）
   * @param {Object} [opts]
   * @param {number} [opts.duration=600]  持续毫秒
   * @param {number} [opts.fps=33]        刷新频率
   * @returns {Promise<void>} 动画结束后 resolve
   */
  function run(el, opts) {
    const options = opts || {};
    if (!el) return Promise.resolve();

    const original = options.text != null ? options.text : el.getAttribute('data-text') || el.textContent;
    el.setAttribute('data-text', original);

    const chars = Array.from(original);
    const reduced = App.util.prefersReducedMotion();
    const duration = reduced ? Math.min(options.duration || 600, 240) : options.duration || 600;
    const interval = 1000 / (options.fps || 33);

    const token = {};
    tokens.set(el, token);
    el.classList.add('is-scrambling');

    const start = performance.now();
    let lastPaint = 0;

    return new Promise((resolve) => {
      function frame(now) {
        if (tokens.get(el) !== token) {
          resolve();
          return;
        }
        const progress = Math.min((now - start) / duration, 1);
        if (now - lastPaint >= interval || progress >= 1) {
          lastPaint = now;
          if (progress >= 1) {
            el.textContent = original;
            el.setAttribute('data-text', original);
          } else {
            // 已还原的部分逐渐变长，后面跟着一段噪声
            const revealed = Math.floor(progress * chars.length * 1.05);
            let out = '';
            for (let i = 0; i < chars.length; i += 1) {
              const ch = chars[i];
              if (ch === '\n') {
                out += ch;
              } else if (i < revealed && ch !== ' ') {
                out += ch;
              } else if (ch === ' ') {
                out += i < revealed ? ' ' : randomGlyph();
              } else {
                out += randomGlyph();
              }
            }
            el.textContent = out;
            el.setAttribute('data-text', out);
          }
        }
        if (progress < 1) requestAnimationFrame(frame);
        else {
          el.classList.remove('is-scrambling');
          resolve();
        }
      }
      requestAnimationFrame(frame);
    });
  }

  return { run, POOL };
})();
