# Simon Fu的博客 · SF-001

> 认可一种善并加以实行，认定一种恶并加以否认，用恶行对抗恶行并取胜，我们和我们的敌人是同类，最后我们也应该自戕。

一个**前后端分离**的单人博客：解构主义 + 废土视觉（参考《明日方舟》UI 语言）。
配色为**米白纸感底 + 深绿主色**，掺入卡其与棕，深绿粗边框配硬阴影，
原生 HTML / CSS / JS 前端（单页、无框架、无打包），Node.js + Express 后端，SQLite 文件型数据库。

```
入场页（破碎拼贴头像 / 超粗叠印标题 / 向下滚动提示）
   │  向下滚动 · 点击提示 · Enter / 空格 / ↓
   ▼
转场（总时长 ≈1.0s，< 1.2s）
   ① 扫描线自上而下扫过全屏
   ② 入场页碎片朝不同方向飞散并淡出（移动端降级为淡出）
   ③ 主站三栏错位滑入：左栏←左、中栏←下、右栏←右
   ④ 主站主标题乱码 0.6s（片假名 + 十六进制）后恢复
   ▼
主站（三栏：个人资料+标签云 / 文章流 / 数据统计）
   ▲  顶栏「封面」按钮返回入场页 —— 音乐播放不中断
```

---

## 1. 环境要求

| 项目 | 要求 | 说明 |
| --- | --- | --- |
| Node.js | **≥ 22.5.0**（推荐 22 LTS / 24，本项目在 Node 24.21 上验证） | 数据库使用 Node 内置的 `node:sqlite`，**无需任何原生编译** |
| 包管理器 | npm（自带）或 pnpm / yarn | 仅需安装 1 个依赖：`express` |
| 浏览器 | Chrome / Edge / Firefox / Safari 新版本 | 使用 `clip-path`、`dialog`、CSS 自定义属性等标准特性 |

> 数据库是**文件型、免安装**的：第一次启动会自动在 `data/blog.db` 建库建表并写入 6 篇示例文章。
> 不需要单独安装 SQLite，也不需要 `better-sqlite3` 之类的原生模块。

## 2. 安装依赖 + 启动步骤

```bash
# ① 进入项目目录
cd simon-blog

# ② 安装依赖（只装 express，约 5 秒）
npm install
#   pnpm 用户： pnpm install
#   yarn 用户： yarn

# ③ 启动服务（默认 http://127.0.0.1:3000）
npm start

# ④ 浏览器打开
#   http://127.0.0.1:3000
```

启动后终端会打印：

```
  ┌──────────────────────────────────────────────┐
  │  SIMON FU 博客 · 服务已启动                  │
  └──────────────────────────────────────────────┘
   前端首页 : http://127.0.0.1:3000
   接口基址 : http://127.0.0.1:3000/api/posts
   数据库   : .../simon-blog/data/blog.db
   Node     : v24.21.0  (node:sqlite 内置驱动)
```

**其他命令**

```bash
npm run dev          # 开发模式（node --watch，改后端代码自动重启）
npm run seed         # 初始化/补齐标签，不动已有文章
npm run reset        # 清空并重建数据库，重新写入 6 篇示例文章
PORT=3001 npm start  # 换端口（Windows PowerShell： $env:PORT=3001; npm start）
```

## 3. 目录结构

```
simon-blog/
├── package.json                 依赖与脚本（仅 express）
├── README.md
├── server/                      后端（Express + SQLite）
│   ├── index.js                 服务入口：REST API + 静态资源 + 错误处理
│   ├── db.js                    建表 / 种子数据 / 仓储层（node:sqlite）
│   └── seed.js                  初始化与重置脚本
├── data/
│   └── blog.db                  SQLite 数据库文件（首次启动自动生成，含 WAL）
└── public/                      前端（原生三件套，直接由 Express 托管）
    ├── index.html               单页结构：入场页 + 主站 + 播放器 + 对话框
    ├── css/
    │   ├── tokens.css           设计令牌 / 重置 / 切角面板 / 按钮 / 对话框 / 特效层
    │   ├── landing.css          入场页（拼贴头像、叠印标题、滚动提示、碎片飞散）
    │   ├── site.css             主站（顶栏、三栏、文章卡、统计、响应式）
    │   └── player.css           音乐播放器浮窗
    └── js/
        ├── config.js            ★ 配置：接口地址、转场时间轴、音频源数组
        ├── util.js              DOM/格式化/提示条/本地存储工具
        ├── api.js               REST 客户端（统一错误处理）
        ├── scramble.js          乱码动画（片假名 + 十六进制）
        ├── parallax.js          背景视差 + 模块 3D 倾斜
        ├── player.js            音乐播放器（拖动/最小化/进度/音量/歌单）
        ├── posts.js             文章系统（增删改查/筛选/检索/展开）
        ├── landing.js           入场页交互（滚动/点击/键盘进入）
        ├── transition.js        转场编排（扫描线→碎片→三栏→乱码）
        └── app.js               启动引导
```

## 4. 数据库表结构

严格按需求实现三张表：

```sql
CREATE TABLE posts (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  title      TEXT    NOT NULL,
  body       TEXT    NOT NULL,
  created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE tags (
  id    INTEGER PRIMARY KEY AUTOINCREMENT,
  name  TEXT    NOT NULL UNIQUE,
  color TEXT    NOT NULL DEFAULT '#8A8F6A'
);

CREATE TABLE post_tags (
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  tag_id  INTEGER NOT NULL REFERENCES tags(id)  ON DELETE CASCADE,
  PRIMARY KEY (post_id, tag_id)
);
```

* 标签为**固定集合**：日常 / 文学 / 音乐 / 艺术 / 随笔 / 影像，每个带自己的主题色；
  启动时自动补齐缺失标签，新增文章时后端只接受这 6 个标签（否则返回 400 并提示可选值）。
* 作者字段不在表里冗余存储：单人博客，作者由服务端配置统一注入到接口响应中
  （`BLOG_AUTHOR` / `BLOG_AUTHOR_CODE` 环境变量可改，默认 `Simon Fu` / `SF-001`）。
* 想看库里的数据：`node -e "console.table(require('node:sqlite').DatabaseSync ? [] : [])"` 或任意 SQLite 客户端打开 `data/blog.db`。

## 5. 接口文档

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/health` | 健康检查 |
| GET | `/api/meta` | 站点元信息（博客名、作者、编号、Node/SQLite、固定标签） |
| GET | `/api/tags` | 标签列表（含每标签文章数） |
| GET | `/api/posts?tag=文学&q=关键词&limit=50&offset=0` | 文章列表（摘要，不含正文；`q` 同时匹配标题/正文/标签名） |
| GET | `/api/posts/:id` | 文章详情（含正文） |
| POST | `/api/posts` | 新建：`{ "title": "...", "body": "...", "tags": ["日常","影像"] }` |
| PUT | `/api/posts/:id` | 更新：同上（`tags` 省略则不动标签） |
| DELETE | `/api/posts/:id` | 删除（前端有二次确认框） |
| GET | `/api/stats` | 统计：文章数、字数、标签数、最近更新、年度归档、标签分布 |

响应示例：

```json
{
  "id": 7,
  "title": "在废墟上搭建一个可以写字的地方",
  "body": "把博客重新做了一遍……",
  "createdAt": "2026-09-30T12:08:42Z",
  "tags": [{ "id": 1, "name": "日常", "color": "#8A8F6A" }],
  "author": { "name": "Simon Fu", "code": "SF-001" }
}
```

错误统一为 `{ "error": "错误信息", "details": { ... } }`，状态码 400（校验失败）/ 404（不存在）/ 500。
前端对每次请求都有加载态（骨架屏 / “载入…”）与错误提示（顶栏状态、提示条、可重试的错误面板）。

## 6. 常见自定义

| 想改什么 | 改哪里 |
| --- | --- |
| **音频源** | `public/js/config.js` → `tracks: [{ title, artist, src }]`，支持任意直链或本地文件（把 mp3 放进 `public/audio/`，`src` 写 `/audio/xxx.mp3`） |
| 博客名 / 作者 / 编号 | `public/index.html` 文案 + `server/index.js` 的 `AUTHOR`（或用环境变量） |
| 端口 / 数据文件位置 | 环境变量 `PORT`、`HOST`、`BLOG_DB`、`BLOG_DATA_DIR`、`BLOG_SEED=0`（跳过示例数据） |
| 转场时长 | `public/js/config.js` → `transition`（默认总时长 1120ms，满足 < 1.2s 要求） |
| 配色 / 切角尺寸 / 字体 | `public/css/tokens.css` 顶部的 CSS 变量（`--paper`、`--green`、`--khaki`、`--brown`、`--cut`、`--hard`…） |
| 标签集合 | `server/db.js` → `TAG_PRESET`（改完删掉 `data/blog.db` 重启即可重建） |

字体：正文 `Noto Serif SC`，标题 `Noto Sans SC 900`（超粗黑体），辅助信息 `JetBrains Mono`，
通过 Google Fonts 引入并配有本地回退（思源黑体 / 宋体 / Consolas），**离线时页面依然正常显示**。

## 7. 功能与验收对照

| 需求 | 实现位置 |
| --- | --- |
| 打开先看到入场页（拼贴头像 / 博客名 / 副标题 / 向下滚动提示） | `landing.css` + `index.html#landing` |
| 破碎拼贴头像：多色调几何碎片，悬停轻微向外飞散，下方 ID: SF-001 / ONLINE | `index.html` 中 12 块 SVG 碎片（`--dx/--dy/--rot` 逐个方向）+ `landing.css` |
| 博客名双层错位叠印（橙红 / 青蓝） | `.brand::before` / `.brand::after` + `attr(data-text)` + `mix-blend-mode: screen` |
| 进入主站：滚动 / 点击提示 / Enter / 空格 / ↓ | `landing.js`（滚轮累积 60px、触摸上滑 52px、键盘） |
| 转场顺序与 1.2s 限制 | `transition.js`（340 → 140 → 330 → 350+600ms） |
| 主站三栏错位滑入 + 主标题乱码 0.6s | `site.css` `colInLeft/colInBottom/colInRight` + `scramble.js` |
| 移动端简化转场（淡入 + 扫描线，不做碎片飞散） | `transition.js` 的 `isSimple()`（≤760px 或 `prefers-reduced-motion`） |
| 顶栏「封面」按钮返回入场页，音乐不中断 | `#player` 位于 `#site` 之外，切页只切换 `#site` 的显隐 |
| 刷新回到入场页 | `transition.boot()` 强制初始为 `landing`（另 `history.scrollRestoration='manual'`） |
| 桌面三栏 / 平板两栏 / 手机单栏 | `site.css` 三档媒体查询（1180px / 760px） |
| 悬停 3D 倾斜 + 背景视差 | `parallax.js`（`.tilt` 写入 `--rx/--ry`，`#bgfx` 各层按 `data-depth` 位移） |
| 文章发布 / 编辑 / 删除（删除有确认框） | `posts.js` + `<dialog>` 撰写面板与确认框 |
| 摘要列表 → 点击展开全文（懒加载正文） | `GET /api/posts` 只返回 `excerpt`，展开时请求 `/api/posts/:id` |
| 标签筛选 / 关键词检索 | `posts.js` `applyFilter()` / `runSearch()`（防抖 320ms） |
| 发布新帖时主标题乱码 0.6s 再恢复 | `posts.js` `submitComposer()` → `App.scramble.run(#siteBrand)` |
| 音乐播放器：拖动 / 最小化 / 上下首 / 进度 / 音量 / 点歌 | `player.js`（Pointer Events 拖动，位置与状态存 localStorage） |
| 页面加载不自动播放 | `audio.preload='metadata'`，只预载元数据，等待用户点击 |
| 移动端浮窗固定在底部 | `player.css` ≤760px 覆盖定位（`!important` 盖过拖拽写入的内联样式） |
| 键盘可操作 / 加载态 / 错误提示 | 全站 `:focus-visible`、原生 `dialog`（Esc 关闭、内含焦点）、骨架屏、`.errbox`、`.toast` |
| 数据持久化 | SQLite（`data/blog.db`，WAL 模式），刷新/重启不丢 |

**快捷键**：入场页 `Enter` / `空格` / `↓` 进入主站；主站 `空格` 播放暂停、`←` / `→` 上下首；
撰写面板 `Ctrl/⌘ + Enter` 保存、`Esc` 取消；对话框 `Esc` 关闭、确认框 `Enter` 确认。

**调试小开关**：访问 `http://127.0.0.1:3000/?view=site` 可跳过入场页直接查看主站（用于截图/排查）。

## 8. 常见问题

| 现象 | 原因与处理 |
| --- | --- |
| 启动报 `ERR_UNKNOWN_BUILTIN_MODULE: node:sqlite` | Node 版本低于 22.5，请升级 Node（`node -v`）；或改用 `better-sqlite3` 并把 `db.js` 顶部的 `DatabaseSync` 换掉 |
| 端口被占用 | `PORT=3001 npm start`（PowerShell：`$env:PORT=3001; npm start`） |
| 页面能打开但列表显示「无法连接后端服务」 | 用 `file://` 直接打开了 `index.html`。必须通过 `npm start` 用 http 访问 |
| 音乐播放器提示加载失败 | 示例音频是公网直链（SoundHelix），离线或跨网时会失败；换成本地文件即可（见第 6 节） |
| 想清空示例文章 | `npm run reset -- --empty`（重置但不写示例数据） |
| 数据库文件在哪 | `simon-blog/data/blog.db`（含 `blog.db-wal` / `blog.db-shm`），删掉它们即可完全重建 |

## 9. 许可

MIT。示例文章与界面文案为演示内容，可自由替换。
