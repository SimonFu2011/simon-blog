'use strict';

/**
 * index.js —— Express 服务：REST API + 静态前端
 *
 *   GET    /api/health          健康检查
 *   GET    /api/meta            站点元信息（作者、编号、版本）
 *   GET    /api/tags            标签列表（含文章计数）
 *   GET    /api/posts           文章列表（?tag=文学&q=关键词&limit=50&offset=0）
 *   GET    /api/posts/:id       文章详情（含正文）
 *   POST   /api/posts           新建文章  { title, body, tags: ["日常","文学"] }
 *   PUT    /api/posts/:id       更新文章  { title, body, tags: [...] }
 *   DELETE /api/posts/:id       删除文章
 *   GET    /api/stats           站点统计
 */

const path = require('node:path');
const os = require('node:os');
const express = require('express');

const db = require('./db');

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '127.0.0.1';
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const AUTHOR = {
  name: process.env.BLOG_AUTHOR || 'Simon Fu',
  code: process.env.BLOG_AUTHOR_CODE || 'SF-001',
};

const app = express();

app.disable('x-powered-by');
app.use(express.json({ limit: '2mb' }));

// 轻量请求日志
app.use((req, res, next) => {
  const started = Date.now();
  res.on('finish', () => {
    if (!req.path.startsWith('/api')) return;
    const ms = Date.now() - started;
    console.log(`${req.method} ${req.originalUrl} -> ${res.statusCode} (${ms}ms)`);
  });
  next();
});

// 基础安全头（不引入额外依赖）
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});

/* ------------------------------------------------------------------ */
/* API                                                                 */
/* ------------------------------------------------------------------ */

const api = express.Router();

/** 统一异步错误处理 */
const wrap = (fn) => (req, res, next) => {
  try {
    const out = fn(req, res, next);
    if (out && typeof out.then === 'function') out.catch(next);
  } catch (err) {
    next(err);
  }
};

const withAuthor = (post) => ({ ...post, author: AUTHOR });

api.get('/health', (req, res) => {
  res.json({ ok: true, time: new Date().toISOString(), uptime: Math.round(process.uptime()) });
});

api.get('/meta', (req, res) => {
  res.json({
    blog: 'Simon Fu的博客',
    author: AUTHOR,
    version: require('../package.json').version,
    node: process.version,
    sqlite: 'node:sqlite',
    database: path.basename(db.DB_FILE),
    tags: db.TAG_PRESET.map((t) => t.name),
  });
});

api.get('/tags', wrap((req, res) => {
  res.json({ items: db.listTags() });
}));

api.get('/posts', wrap((req, res) => {
  const { tag, q, limit, offset } = req.query;
  const result = db.listPosts({ tag, q, limit, offset });
  res.json({
    items: result.items.map(withAuthor),
    total: result.total,
    filter: { tag: tag || null, q: q || null },
  });
}));

api.get('/posts/:id', wrap((req, res) => {
  res.json(withAuthor(db.getPost(req.params.id)));
}));

api.post('/posts', wrap((req, res) => {
  const post = db.createPost(req.body);
  console.log(`[api] 新建文章 #${post.id} 《${post.title}》`);
  res.status(201).json(withAuthor(post));
}));

api.put('/posts/:id', wrap((req, res) => {
  const post = db.updatePost(req.params.id, req.body);
  console.log(`[api] 更新文章 #${post.id} 《${post.title}》`);
  res.json(withAuthor(post));
}));

api.delete('/posts/:id', wrap((req, res) => {
  const removed = db.deletePost(req.params.id);
  console.log(`[api] 删除文章 #${removed.id} 《${removed.title}》`);
  res.json({ ok: true, removed });
}));

api.get('/stats', wrap((req, res) => {
  res.json({ ...db.stats(), author: AUTHOR, serverTime: new Date().toISOString() });
}));

api.use((req, res) => {
  res.status(404).json({ error: `接口不存在：${req.method} ${req.originalUrl}` });
});

app.use('/api', api);

/* ------------------------------------------------------------------ */
/* 静态前端                                                            */
/* ------------------------------------------------------------------ */

app.use(
  express.static(PUBLIC_DIR, {
    etag: true,
    lastModified: true,
    setHeaders(res, filePath) {
      if (/\.(?:png|jpe?g|svg|woff2?|ico)$/i.test(filePath)) {
        res.setHeader('Cache-Control', 'public, max-age=86400');
      } else {
        res.setHeader('Cache-Control', 'no-cache');
      }
    },
  })
);

// 单页回退：非 /api 的 GET 请求一律返回首页
app.use((req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'), (err) => (err ? next(err) : undefined));
});

/* ------------------------------------------------------------------ */
/* 错误处理                                                            */
/* ------------------------------------------------------------------ */

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err instanceof db.HttpError ? err.status : err.status || 500;
  if (status >= 500) console.error('[error]', err);
  const payload = { error: err.message || '服务器内部错误' };
  if (err.details) payload.details = err.details;
  if (status >= 500 && process.env.NODE_ENV !== 'production') payload.stack = err.stack;
  res.status(status).json(payload);
});

/* ------------------------------------------------------------------ */
/* 启动                                                                */
/* ------------------------------------------------------------------ */

db.getDb(); // 触发建表 + 首次种子数据

const server = app.listen(PORT, HOST, () => {
  const url = `http://${HOST}:${PORT}`;
  console.log('');
  console.log('  ┌──────────────────────────────────────────────┐');
  console.log('  │  SIMON FU 博客 · 服务已启动                  │');
  console.log('  └──────────────────────────────────────────────┘');
  console.log(`   前端首页 : ${url}`);
  console.log(`   接口基址 : ${url}/api/posts`);
  console.log(`   数据库   : ${db.DB_FILE}`);
  console.log(`   Node     : ${process.version}  (node:sqlite 内置驱动)`);
  console.log(`   本机地址 : http://${localIPv4() || 'localhost'}:${PORT}`);
  console.log('   Ctrl+C 停止服务');
  console.log('');
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n[启动失败] 端口 ${PORT} 已被占用。可用 PORT=3001 npm start 换一个端口。\n`);
  } else {
    console.error('[启动失败]', err);
  }
  process.exit(1);
});

function localIPv4() {
  for (const list of Object.values(os.networkInterfaces())) {
    for (const net of list || []) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return null;
}

let closing = false;
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    if (closing) return;
    closing = true;
    console.log('\n[server] 正在关闭…');
    server.close(() => {
      db.closeDb();
      console.log('[server] 已停止');
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 1500).unref();
  });
}

module.exports = app;
