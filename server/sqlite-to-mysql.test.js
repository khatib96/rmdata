const { test } = require('node:test');
const assert = require('node:assert');
const { sqliteToMysql } = require('./sqlite-to-mysql.js');

test('datetime(now) to NOW()', () => {
  assert.ok(sqliteToMysql("UPDATE users SET x = datetime('now')").includes('NOW()'));
});

test('settings insert with reserved key', () => {
  const q = "INSERT INTO settings (key, value, updatedAt) VALUES (?, ?, datetime('now'))";
  const out = sqliteToMysql(q);
  assert.match(out, /`key`/);
  assert.match(out, /`value`/);
  assert.ok(out.includes('NOW()'));
});

test('sqlite_master table check', () => {
  const q = "SELECT name FROM sqlite_master WHERE type='table' AND name=?";
  const out = sqliteToMysql(q);
  assert.ok(out.includes('information_schema.tables'));
  assert.ok(!out.includes('sqlite_master'));
});

test('datetime offset', () => {
  const out = sqliteToMysql("SELECT * FROM t WHERE d > datetime('now', '-7 days')");
  assert.ok(out.includes('DATE_SUB(NOW(), INTERVAL 7 DAY)'));
});

test('last_insert_rowid', () => {
  assert.ok(sqliteToMysql('SELECT last_insert_rowid()').includes('LAST_INSERT_ID()'));
});

test('INSERT OR IGNORE', () => {
  assert.ok(sqliteToMysql('INSERT OR IGNORE INTO t (a) VALUES (1)').includes('INSERT IGNORE'));
});
