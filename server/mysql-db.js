const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

/** تحميل `.env` من جذر المشروع (لا يستبدل متغيرات البيئة المعيّنة مسبقاً) */
(function loadRootEnvFile() {
  try {
    const envPath = path.join(__dirname, '..', '.env');
    if (!fs.existsSync(envPath)) return;
    const raw = fs.readFileSync(envPath, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (key && process.env[key] === undefined) process.env[key] = val;
    }
  } catch (e) {
    console.warn('mysql-db: could not read .env:', e instanceof Error ? e.message : String(e));
  }
})();

const DB_NAME = process.env.DB_NAME;
const DB_USER = process.env.DB_USER;

if (!DB_NAME || !DB_USER) {
  console.error(
    'dev-api-server: DB_NAME and DB_USER must be set (MariaDB). Copy .env.example to .env in the project root, or export DB_* in the shell. See SETUP.md.'
  );
  process.exit(1);
}

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  database: DB_NAME,
  user: DB_USER,
  password: process.env.DB_PASSWORD != null ? String(process.env.DB_PASSWORD) : '',
  waitForConnections: true,
  connectionLimit: 10,
});

console.log('MariaDB pool:', process.env.DB_HOST || 'localhost', DB_NAME);

async function pingDb() {
  await pool.query('SELECT 1');
}

/**
 * @param {string} query
 * @param {unknown[]} [params]
 */
async function dbAll(query, params = []) {
  const [rows] = await pool.execute(query, params);
  return rows && Array.isArray(rows) ? rows : [];
}

/**
 * @param {string} query
 * @param {unknown[]} [params]
 * @returns {Promise<{ changes: number, lastID: number }>}
 */
async function dbRun(query, params = []) {
  const [result] = await pool.execute(query, params);
  const insertId = result.insertId != null ? Number(result.insertId) : 0;
  return {
    changes: result.affectedRows ?? 0,
    lastID: insertId,
  };
}

/**
 * Run multiple statements in one transaction/connection.
 * @template T
 * @param {(ctx: {
 *   all: (query: string, params?: unknown[]) => Promise<any[]>,
 *   run: (query: string, params?: unknown[]) => Promise<{ changes: number, lastID: number }>
 * }) => Promise<T>} fn
 * @returns {Promise<T>}
 */
async function withTransaction(fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const ctx = {
      all: async (query, params = []) => {
        const [rows] = await conn.execute(query, params);
        return rows && Array.isArray(rows) ? rows : [];
      },
      run: async (query, params = []) => {
        const [result] = await conn.execute(query, params);
        const insertId = result.insertId != null ? Number(result.insertId) : 0;
        return {
          changes: result.affectedRows ?? 0,
          lastID: insertId,
        };
      },
    };
    const out = await fn(ctx);
    await conn.commit();
    return out;
  } catch (e) {
    try { await conn.rollback(); } catch {}
    throw e;
  } finally {
    conn.release();
  }
}

module.exports = { pool, dbAll, dbRun, pingDb, withTransaction };
