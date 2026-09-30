'use strict';

/**
 * seed.js —— 数据库初始化 / 重置脚本
 *
 *   npm run seed          初始化（建表 + 补齐固定标签，不动已有文章）
 *   npm run reset         清空并重建（重新写入 4 篇示例文章）
 *   node server/seed.js --reset --empty    清空并重建，但不写示例文章
 */

const db = require('./db');

const args = process.argv.slice(2);
const reset = args.includes('--reset');
const empty = args.includes('--empty');

console.log(`[seed] 数据库文件：${db.DB_FILE}`);

if (reset) {
  const result = db.reset({ withSamples: !empty });
  console.log(`[seed] 已重置 → 文章 ${result.posts} 篇 / 标签 ${result.tags} 个`);
} else {
  db.getDb();
  console.log(`[seed] 已确保表结构存在，标签集合就绪`);
}

console.log('[seed] 标签：', db.listTags().map((t) => `${t.name}(${t.count})`).join('  '));
console.log(`[seed] 文章总数：${db.stats().postCount}`);
db.closeDb();
