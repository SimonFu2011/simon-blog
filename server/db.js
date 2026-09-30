'use strict';

/**
 * db.js —— SQLite 数据访问层
 *
 * 使用 Node.js 内置模块 node:sqlite（Node >= 22.5 提供，24.x 已稳定），
 * 因此项目不需要任何原生编译依赖，数据库就是一个普通的 .db 文件。
 *
 * 表结构（与需求严格一致）：
 *   posts     (id, title, body, created_at)
 *   tags      (id, name, color)
 *   post_tags (post_id, tag_id)
 */

const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const ROOT = path.join(__dirname, '..');
const DATA_DIR = process.env.BLOG_DATA_DIR
  ? path.resolve(process.env.BLOG_DATA_DIR)
  : path.join(ROOT, 'data');
const DB_FILE = process.env.BLOG_DB
  ? path.resolve(process.env.BLOG_DB)
  : path.join(DATA_DIR, 'blog.db');

/** 固定标签集合（名称 + 主题色，取自废土色板） */
const TAG_PRESET = [
  { name: '日常', color: '#8A8F6A' },
  { name: '文学', color: '#C4552E' },
  { name: '音乐', color: '#2F7E8C' },
  { name: '艺术', color: '#A8823C' },
  { name: '随笔', color: '#6B6459' },
  { name: '影像', color: '#3F5138' },
];

/** 示例文章的时间：相对"现在"的偏移（保证归档时间线新鲜且永远位于过去） */
const ago = (days, hour = 21, minute = 12) => {
  const d = new Date(Date.now() - days * 86400000);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString().replace(/\.\d{3}Z$/, 'Z');
};
const hoursAgo = (hours) => new Date(Date.now() - hours * 3600000).toISOString().replace(/\.\d{3}Z$/, 'Z');

/** 首次启动时写入的示例文章，让页面不至于空着 */
const SAMPLE_POSTS = [
  {
    title: '在废墟上搭建一个可以写字的地方',
    created_at: hoursAgo(5),
    tags: ['日常', '随笔'],
    body: `把博客重新做了一遍。这一次不再追求"现代的圆角"，而是想要一种被风沙刮过的质感——米灰、卡其、黑棕，边角被切掉，边框是粗黑的，阴影是硬的。

写字的容器应该是什么样子？我认为它首先应该是一个结构，其次才是一个界面。所以这里所有的面板都是斜切的：信息被切开、错位、再叠印一次，像旧印刷机对不齐的套色。

接下来会陆续把过去散落在各处的文字搬过来。搬运本身就是一次重新整理，很多当时觉得重要的东西，现在看起来只是碎屑。

—— 但碎屑也是地层的一部分。`,
  },
  {
    title: '关于阅读：把一本书读到起毛边',
    created_at: ago(4, 23, 8),
    tags: ['文学', '随笔'],
    body: `重读是一件比初读更残酷的事情。初读时你在探险，重读时你在核对账目——核对当年那个自己被哪一句话击中过。

我习惯在书页边缘画竖线，竖线越密的地方，说明当时的我越焦躁。几年后回看，那些焦躁大多已经平息，只剩下一条条歪斜的线，像心电图。

好的书应该被读得起毛边。太干净的书房是可疑的。`,
  },
  {
    title: '循环播放：写给深夜的三首曲子',
    created_at: ago(17, 2, 30),
    tags: ['音乐', '影像'],
    body: `一、低频先到。低频是空间本身，它不表达情绪，它只是把房间的尺寸撑大。

二、中频随后进入，那是人的位置。旋律是人的轮廓，模糊但有边界。

三、高频最后落下，像灰尘，也像雪。它落在所有东西的表面上，让一切看起来旧了一点点。

深夜听歌不需要推荐算法，需要的是一张不会跳针的唱片和一段不需要解释的时间。`,
  },
  {
    title: '影像笔记：城市的背面',
    created_at: ago(46, 19, 5),
    tags: ['影像', '艺术'],
    body: `拍城市有两个方向：向上拍天际线，向下拍排水口。前者是宣言，后者是证据。

我更喜欢证据。霓虹灯管坏掉的那一截、卷帘门上的锈、配电箱上被撕掉一半的告示——这些是城市来不及修饰的部分。

构图的原则只有一条：让画面里同时存在"秩序"和"秩序的失效"。`,
  },
  {
    title: '旧磁带、噪点与一种被磨损的听感',
    created_at: ago(112, 1, 47),
    tags: ['音乐', '艺术'],
    body: `磁带最迷人的部分不是它的音质，而是它的不可逆性。每一次播放都是一次轻微的磨损，第十次和第一次听到的是两盘不同的带子。

数字音频把这种损耗彻底删除了，于是我们失去了"版本"这个概念：你听的永远是第一次，也永远是最后一次。

我开始刻意在录音里保留底噪。底噪是空间存在的证明，一个绝对安静的房间在物理上是不成立的。`,
  },
  {
    title: '凌晨四点的城市与一碗面',
    created_at: ago(268, 4, 12),
    tags: ['日常', '随笔'],
    body: `凌晨四点，只有两种人还在街上：刚结束的，和还没开始的。

面馆的灯是白的，不是暖黄。老板娘不看客人，只看锅。汤滚起来的时候，整间屋子都在震动，像某种低沉的机械在呼吸。

我吃完面，走出去，天还没亮。那一刻我觉得自己是这座城市的一颗螺丝——不重要，但正在承重。`,
  },
];

/* ------------------------------------------------------------------ */
/* 错误类型                                                            */
/* ------------------------------------------------------------------ */

class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.details = details;
  }
}

/* ------------------------------------------------------------------ */
/* 连接与建表                                                          */
/* ------------------------------------------------------------------ */

let db = null;

function getDb() {
  if (db) return db;
  fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
  db = new DatabaseSync(DB_FILE);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  migrate(db);
  return db;
}

function migrate(handle) {
  handle.exec(`
    CREATE TABLE IF NOT EXISTS posts (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      title      TEXT    NOT NULL,
      body       TEXT    NOT NULL,
      created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );

    CREATE TABLE IF NOT EXISTS tags (
      id    INTEGER PRIMARY KEY AUTOINCREMENT,
      name  TEXT    NOT NULL UNIQUE,
      color TEXT    NOT NULL DEFAULT '#8A8F6A'
    );

    CREATE TABLE IF NOT EXISTS post_tags (
      post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      tag_id  INTEGER NOT NULL REFERENCES tags(id)  ON DELETE CASCADE,
      PRIMARY KEY (post_id, tag_id)
    );

    CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_post_tags_tag    ON post_tags(tag_id);
    CREATE INDEX IF NOT EXISTS idx_post_tags_post   ON post_tags(post_id);
  `);
  seedTags(handle);
  seedPosts(handle);
}

/** 标签是固定集合：缺失则插入，已存在则同步颜色 */
function seedTags(handle) {
  const insert = handle.prepare('INSERT INTO tags (name, color) VALUES (?, ?)');
  const update = handle.prepare('UPDATE tags SET color = ? WHERE name = ?');
  const find = handle.prepare('SELECT id, color FROM tags WHERE name = ?');
  for (const tag of TAG_PRESET) {
    const row = find.get(tag.name);
    if (!row) insert.run(tag.name, tag.color);
    else if (row.color !== tag.color) update.run(tag.color, tag.name);
  }
}

function seedPosts(handle) {
  if (process.env.BLOG_SEED === '0') return;
  const { count } = handle.prepare('SELECT COUNT(*) AS count FROM posts').get();
  if (count > 0) return;
  for (const sample of SAMPLE_POSTS) insertPost(handle, sample);
  console.log(`[db] 已写入 ${SAMPLE_POSTS.length} 篇示例文章（可用 npm run reset 重置）`);
}

/* ------------------------------------------------------------------ */
/* 工具                                                                */
/* ------------------------------------------------------------------ */

const nowIso = () => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

function escapeLike(value) {
  return String(value).replace(/[\\%_]/g, (m) => `\\${m}`);
}

function tagsOfPosts(handle, postIds) {
  const map = new Map(postIds.map((id) => [id, []]));
  if (postIds.length === 0) return map;
  const placeholders = postIds.map(() => '?').join(',');
  const rows = handle
    .prepare(
      `SELECT pt.post_id AS postId, t.id, t.name, t.color
         FROM post_tags pt
         JOIN tags t ON t.id = pt.tag_id
        WHERE pt.post_id IN (${placeholders})
        ORDER BY t.id`
    )
    .all(...postIds);
  for (const row of rows) {
    map.get(row.postId)?.push({ id: row.id, name: row.name, color: row.color });
  }
  return map;
}

/** 把前端传来的标签（名称数组 / id 数组）解析为合法 tag id */
function resolveTagIds(handle, input) {
  const raw = Array.isArray(input) ? input : [];
  const names = [];
  const ids = [];
  for (const item of raw) {
    if (item === null || item === undefined || item === '') continue;
    if (typeof item === 'number' || /^\d+$/.test(String(item))) ids.push(Number(item));
    else names.push(String(item).trim());
  }
  const all = handle.prepare('SELECT id, name FROM tags').all();
  const byName = new Map(all.map((t) => [t.name, t.id]));
  const byId = new Map(all.map((t) => [t.id, t.name]));
  const resolved = new Set();
  const unknown = [];
  for (const name of names) {
    if (byName.has(name)) resolved.add(byName.get(name));
    else unknown.push(name);
  }
  for (const id of ids) {
    if (byId.has(id)) resolved.add(id);
    else unknown.push(String(id));
  }
  if (unknown.length) {
    throw new HttpError(400, `存在未知标签：${unknown.join('、')}`, {
      allowedTags: all.map((t) => t.name),
    });
  }
  return [...resolved];
}

/* ------------------------------------------------------------------ */
/* 校验                                                                */
/* ------------------------------------------------------------------ */

const TITLE_MAX = 120;
const BODY_MAX = 60000;

function normalizePostInput(payload) {
  const data = payload && typeof payload === 'object' ? payload : {};
  const title = typeof data.title === 'string' ? data.title.trim() : '';
  const body = typeof data.body === 'string' ? data.body.trim() : '';
  const errors = [];
  if (!title) errors.push('标题不能为空');
  else if (title.length > TITLE_MAX) errors.push(`标题不能超过 ${TITLE_MAX} 个字符`);
  if (!body) errors.push('正文不能为空');
  else if (body.length > BODY_MAX) errors.push(`正文不能超过 ${BODY_MAX} 个字符`);
  if (errors.length) throw new HttpError(400, errors.join('；'), { errors });
  return { title, body, tags: data.tags };
}

/* ------------------------------------------------------------------ */
/* 查询（仓储层）                                                      */
/* ------------------------------------------------------------------ */

function insertPost(handle, { title, body, created_at, created_at_iso, tags }) {
  if (!title || !body) throw new HttpError(400, '标题与正文不能为空');
  const info = handle
    .prepare('INSERT INTO posts (title, body, created_at) VALUES (?, ?, ?)')
    .run(title, body, created_at || created_at_iso || nowIso());
  const id = Number(info.lastInsertRowid);
  const tagIds = resolveTagIds(handle, tags);
  const link = handle.prepare('INSERT OR IGNORE INTO post_tags (post_id, tag_id) VALUES (?, ?)');
  for (const tagId of tagIds) link.run(id, tagId);
  return id;
}

function listPosts({ tag, q, limit = 50, offset = 0 } = {}) {
  const handle = getDb();
  const where = [];
  const params = [];
  let join = '';
  if (tag) {
    join = 'JOIN post_tags pt ON pt.post_id = p.id JOIN tags t ON t.id = pt.tag_id';
    where.push('t.name = ?');
    params.push(String(tag));
  }
  if (q) {
    where.push(
      `(p.title LIKE ? ESCAPE '\\' OR p.body LIKE ? ESCAPE '\\' OR EXISTS (
          SELECT 1 FROM post_tags pt2 JOIN tags t2 ON t2.id = pt2.tag_id
           WHERE pt2.post_id = p.id AND t2.name LIKE ? ESCAPE '\\'))`
    );
    const needle = `%${escapeLike(q)}%`;
    params.push(needle, needle, needle);
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = handle
    .prepare(`SELECT COUNT(DISTINCT p.id) AS count FROM posts p ${join} ${clause}`)
    .get(...params).count;

  const rows = handle
    .prepare(
      `SELECT DISTINCT p.id, p.title, p.created_at,
              SUBSTR(p.body, 1, 200) AS excerpt,
              LENGTH(p.body) AS bodyLength
         FROM posts p ${join} ${clause}
        ORDER BY datetime(p.created_at) DESC, p.id DESC
        LIMIT ? OFFSET ?`
    )
    .all(...params, Math.min(Number(limit) || 50, 200), Math.max(Number(offset) || 0, 0));

  const tagMap = tagsOfPosts(handle, rows.map((r) => r.id));
  const items = rows.map((row) => ({
    id: row.id,
    title: row.title,
    excerpt: row.excerpt.length >= 200 ? `${row.excerpt}…` : row.excerpt,
    createdAt: row.created_at,
    bodyLength: row.bodyLength,
    tags: tagMap.get(row.id) || [],
  }));
  return { items, total };
}

function getPost(id) {
  const handle = getDb();
  const row = handle.prepare('SELECT id, title, body, created_at FROM posts WHERE id = ?').get(Number(id));
  if (!row) throw new HttpError(404, `文章 #${id} 不存在`);
  const tagMap = tagsOfPosts(handle, [row.id]);
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    createdAt: row.created_at,
    tags: tagMap.get(row.id) || [],
  };
}

function createPost(payload) {
  const handle = getDb();
  const { title, body, tags } = normalizePostInput(payload);
  handle.exec('BEGIN');
  try {
    const id = insertPost(handle, { title, body, tags });
    handle.exec('COMMIT');
    return getPost(id);
  } catch (err) {
    handle.exec('ROLLBACK');
    throw err;
  }
}

function updatePost(id, payload) {
  const handle = getDb();
  const postId = Number(id);
  const exists = handle.prepare('SELECT id FROM posts WHERE id = ?').get(postId);
  if (!exists) throw new HttpError(404, `文章 #${postId} 不存在`);
  const { title, body, tags } = normalizePostInput(payload);
  handle.exec('BEGIN');
  try {
    handle.prepare('UPDATE posts SET title = ?, body = ? WHERE id = ?').run(title, body, postId);
    if (tags !== undefined) {
      const tagIds = resolveTagIds(handle, tags);
      handle.prepare('DELETE FROM post_tags WHERE post_id = ?').run(postId);
      const link = handle.prepare('INSERT OR IGNORE INTO post_tags (post_id, tag_id) VALUES (?, ?)');
      for (const tagId of tagIds) link.run(postId, tagId);
    }
    handle.exec('COMMIT');
    return getPost(postId);
  } catch (err) {
    handle.exec('ROLLBACK');
    throw err;
  }
}

function deletePost(id) {
  const handle = getDb();
  const postId = Number(id);
  const row = handle.prepare('SELECT id, title FROM posts WHERE id = ?').get(postId);
  if (!row) throw new HttpError(404, `文章 #${postId} 不存在`);
  handle.prepare('DELETE FROM posts WHERE id = ?').run(postId);
  return { id: postId, title: row.title };
}

function listTags() {
  const handle = getDb();
  return handle
    .prepare(
      `SELECT t.id, t.name, t.color, COUNT(pt.post_id) AS count
         FROM tags t
         LEFT JOIN post_tags pt ON pt.tag_id = t.id
        GROUP BY t.id
        ORDER BY t.id`
    )
    .all()
    .map((row) => ({ id: row.id, name: row.name, color: row.color, count: row.count }));
}

function stats() {
  const handle = getDb();
  const { postCount } = handle.prepare('SELECT COUNT(*) AS postCount FROM posts').get();
  const { tagCount } = handle.prepare('SELECT COUNT(*) AS tagCount FROM tags').get();
  const { charSum } = handle
    .prepare("SELECT COALESCE(SUM(LENGTH(REPLACE(REPLACE(body, char(10), ''), ' ', ''))), 0) AS charSum FROM posts")
    .get();
  const latest = handle.prepare('SELECT MAX(created_at) AS latest FROM posts').get().latest;
  const earliest = handle.prepare('SELECT MIN(created_at) AS earliest FROM posts').get().earliest;
  const byYear = handle
    .prepare(
      `SELECT SUBSTR(created_at, 1, 4) AS year, COUNT(*) AS count
         FROM posts GROUP BY year ORDER BY year DESC`
    )
    .all()
    .map((row) => ({ year: row.year, count: row.count }));
  const topTags = listTags()
    .filter((t) => t.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);
  return {
    postCount,
    tagCount,
    charCount: charSum,
    latestAt: latest || null,
    firstAt: earliest || null,
    byYear,
    topTags,
  };
}

/** 全量重置（seed.js --reset 使用） */
function reset({ withSamples = true } = {}) {
  const handle = getDb();
  handle.exec('BEGIN');
  try {
    handle.exec('DELETE FROM post_tags; DELETE FROM posts; DELETE FROM tags;');
    handle.exec("DELETE FROM sqlite_sequence WHERE name IN ('posts','tags');");
    handle.exec('COMMIT');
  } catch (err) {
    handle.exec('ROLLBACK');
    throw err;
  }
  seedTags(handle);
  if (withSamples) for (const sample of SAMPLE_POSTS) insertPost(handle, sample);
  return { posts: listPosts().total, tags: listTags().length };
}

function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}

module.exports = {
  DB_FILE,
  DATA_DIR,
  TAG_PRESET,
  SAMPLE_POSTS,
  HttpError,
  getDb,
  closeDb,
  listPosts,
  getPost,
  createPost,
  updatePost,
  deletePost,
  listTags,
  stats,
  reset,
};
