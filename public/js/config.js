/* ==========================================================================
   config.js —— 全局配置（前端唯一需要改动的文件之一）
   原生脚本，无打包步骤；所有模块挂在 window.App 命名空间下。
   ========================================================================== */
'use strict';

window.App = window.App || {};

App.config = {
  /* 后端接口基址：与 Express 同源部署，一般无需修改 */
  apiBase: '/api',

  /* 站点信息 */
  blog: 'Simon Fu的博客',
  author: 'Simon Fu',
  authorCode: 'SF-001',

  /* 标签固定集合（与后端 tags 表保持一致，仅用于兜底展示） */
  tagPreset: ['日常', '文学', '音乐', '艺术', '随笔', '影像'],

  /* ---------- 入场转场时间轴（毫秒，总时长 < 1200ms） ---------- */
  transition: {
    sweep: 340,          // 扫描线从上到下扫过
    flyStart: 140,       // 入场页碎片开始飞散
    colStart: 330,       // 主站三栏开始错位滑入
    colDur: 420,         // 单栏滑入时长
    colStagger: 60,      // 三栏之间的错位间隔
    scrambleStart: 350,  // 主标题开始乱码
    scrambleDur: 600,    // 乱码持续 0.6s
    simpleColDur: 300,   // 移动端简化转场时长
    total: 1120,         // 兜底总时长
  },

  /* ---------- 音乐播放器：音频源数组，直接替换 src 即可 ----------
     支持任意可访问的音频直链，或把文件放到 public/audio/ 下写成
     { title: '曲名', artist: '作者', src: '/audio/xxx.mp3' }        */
  tracks: [
    { title: '锈色信标', artist: 'RUST BEACON', src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' },
    { title: '夜行列车', artist: 'NIGHT TRAIN', src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3' },
    { title: '沙暴频率', artist: 'SANDSTORM FREQ', src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3' },
    { title: '废弃港区', artist: 'ABANDONED PORT', src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3' },
    { title: '静默协议', artist: 'SILENT PROTOCOL', src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3' },
    { title: '长夜将尽', artist: 'BEFORE DAWN', src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3' },
  ],

  /* localStorage 键名 */
  storageKeys: {
    player: 'sfblog.player.v1',
    lastTag: 'sfblog.filter.v1',
  },

  /* 断点：与 CSS 保持一致 */
  breakpoints: { mobile: 760, tablet: 1180 },
};
