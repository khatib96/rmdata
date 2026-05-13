/**
 * Sync local files (images, documents) to the remote API server.
 * Reads all file paths from the local SQLite DB, uploads each to the server,
 * and updates the DB to use normalized relative paths.
 *
 * Usage:
 *   node scripts/sync-files-to-server.js <API_BASE_URL> <USERNAME> <PASSWORD>
 *
 * Example:
 *   node scripts/sync-files-to-server.js https://rmdata.alredaa-almuwahad.com admin YourPassword
 */
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

const API_BASE = (process.argv[2] || '').replace(/\/+$/, '');
const USERNAME = process.argv[3] || '';
const PASSWORD = process.argv[4] || '';

if (!API_BASE || !USERNAME || !PASSWORD) {
  console.error('Usage: node sync-files-to-server.js <API_BASE_URL> <USERNAME> <PASSWORD>');
  process.exit(1);
}

const userDataDir = path.join(
  process.env.APPDATA || path.join(require('os').homedir(), '.config'),
  'RMDATA.System'
);
const oldUserDataDir = path.join(
  process.env.APPDATA || path.join(require('os').homedir(), '.config'),
  'alredaa-erp-system'
);

const dbPath = path.join(userDataDir, 'uniform_base.db');
if (!fs.existsSync(dbPath)) {
  console.error('Database not found at:', dbPath);
  process.exit(1);
}

const FILE_COLUMNS = [
  { table: 'branches', column: 'photoPath' },
  { table: 'employers', column: 'photoPath' },
  { table: 'employees', column: 'imagePath' },
  { table: 'vehicles', column: 'photoPath' },
  { table: 'users', column: 'avatarPath' },
  { table: 'documents', column: 'relativePath' },
];

function toRelativePath(absOrRel) {
  if (!absOrRel || typeof absOrRel !== 'string') return null;
  const normalized = absOrRel.replace(/\\/g, '/');

  for (const base of [userDataDir, oldUserDataDir]) {
    const normalizedBase = base.replace(/\\/g, '/');
    if (normalized.startsWith(normalizedBase + '/')) {
      return normalized.slice(normalizedBase.length + 1);
    }
  }

  if (/^[A-Z]:\//i.test(normalized)) return null;
  return normalized;
}

function findLocalFile(originalPath) {
  if (!originalPath) return null;
  const normalized = originalPath.replace(/\\/g, '/');

  if (fs.existsSync(originalPath)) return originalPath;

  for (const base of [userDataDir, oldUserDataDir]) {
    const normalizedBase = base.replace(/\\/g, '/');
    if (normalized.startsWith(normalizedBase + '/')) {
      const rel = normalized.slice(normalizedBase.length + 1);
      for (const altBase of [userDataDir, oldUserDataDir]) {
        const altFull = path.join(altBase, rel);
        if (fs.existsSync(altFull)) return altFull;
      }
    }
  }

  for (const base of [userDataDir, oldUserDataDir]) {
    const tryFull = path.join(base, normalized);
    if (fs.existsSync(tryFull)) return tryFull;
    const tryDocs = path.join(base, 'documents', normalized);
    if (fs.existsSync(tryDocs)) return tryDocs;
  }

  return null;
}

async function login() {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: USERNAME, password: PASSWORD }),
  });
  const json = await res.json();
  if (!json.success || !json.token) {
    throw new Error('Login failed: ' + (json.error || 'unknown'));
  }
  return json.token;
}

async function uploadFile(token, relativePath, fileBuffer, fileName, extra = {}) {
  const boundary = '----SyncBoundary' + Date.now();
  const ext = path.extname(fileName).toLowerCase().slice(1);
  const mimeMap = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', pdf: 'application/pdf' };
  const mime = mimeMap[ext] || 'application/octet-stream';
  const kind = extra.kind || (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext) ? 'image' : 'document');

  const parts = [];
  parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="kind"\r\n\r\n${kind}`);
  parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="relativePath"\r\n\r\n${relativePath}`);
  if (extra.skipDbInsert) parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="skipDbInsert"\r\n\r\n1`);
  if (extra.entityType) parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="entityType"\r\n\r\n${extra.entityType}`);
  if (extra.entityId) parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="entityId"\r\n\r\n${extra.entityId}`);
  if (extra.section) parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="section"\r\n\r\n${extra.section}`);
  if (extra.customName) parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="customName"\r\n\r\n${extra.customName}`);
  parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\nContent-Type: ${mime}\r\n\r\n`);

  const header = Buffer.from(parts.join('\r\n') + '\r\n', 'utf-8');
  const footer = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf-8');
  const body = Buffer.concat([header, fileBuffer, footer]);

  const res = await fetch(`${API_BASE}/api/files/upload`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    },
    body,
  });
  const json = await res.json();
  return json;
}

async function main() {
  console.log('Logging in to API...');
  const token = await login();
  console.log('Logged in successfully.\n');

  const db = new sqlite3.Database(dbPath);

  let totalFiles = 0;
  let uploaded = 0;
  let skipped = 0;
  let notFound = 0;
  let pathsUpdated = 0;

  for (const { table, column } of FILE_COLUMNS) {
    console.log(`\n--- Scanning ${table}.${column} ---`);

    const isDocTable = table === 'documents';
    const selectCols = isDocTable
      ? `id, ${column}, entityType, entityId, section, customName`
      : `id, ${column}`;

    let rows;
    try {
      rows = await new Promise((resolve, reject) => {
        db.all(`SELECT ${selectCols} FROM ${table} WHERE ${column} IS NOT NULL AND ${column} != ''`, [], (err, rows) => {
          if (err) reject(err); else resolve(rows);
        });
      });
    } catch (err) {
      console.log(`  [SKIP] table/column not found: ${err.message}`);
      continue;
    }

    for (const row of rows) {
      const originalPath = row[column];
      totalFiles++;

      const relativePath = toRelativePath(originalPath);
      if (!relativePath) {
        console.log(`  [SKIP] id=${row.id} - cannot normalize path: ${originalPath}`);
        skipped++;
        continue;
      }

      const localFile = findLocalFile(originalPath);
      if (!localFile) {
        console.log(`  [NOT FOUND] id=${row.id} - ${originalPath}`);
        notFound++;
        continue;
      }

      try {
        const fileBuffer = fs.readFileSync(localFile);
        const fileName = path.basename(localFile);
        console.log(`  [UPLOAD] id=${row.id} - ${relativePath} (${(fileBuffer.length / 1024).toFixed(1)} KB)`);

        // Row already exists in DB — only upload bytes to storage (skipDbInsert)
        const extra = isDocTable ? { skipDbInsert: true } : {};
        const result = await uploadFile(token, relativePath, fileBuffer, fileName, extra);
        if (result.success) {
          uploaded++;
        } else {
          console.log(`    -> Upload failed: ${result.error || 'unknown'}`);
          skipped++;
          continue;
        }
      } catch (err) {
        console.log(`    -> Error: ${err.message}`);
        skipped++;
        continue;
      }

      if (originalPath !== relativePath) {
        await new Promise((resolve, reject) => {
          db.run(`UPDATE ${table} SET ${column} = ? WHERE id = ?`, [relativePath, row.id], (err) => {
            if (err) reject(err); else resolve();
          });
        });
        pathsUpdated++;
      }
    }
  }

  db.close();

  console.log('\n========== SYNC COMPLETE ==========');
  console.log(`Total files found:   ${totalFiles}`);
  console.log(`Uploaded:            ${uploaded}`);
  console.log(`Not found locally:   ${notFound}`);
  console.log(`Skipped/errors:      ${skipped}`);
  console.log(`Paths updated in DB: ${pathsUpdated}`);
  console.log('===================================\n');

  if (pathsUpdated > 0) {
    console.log('NOTE: Local DB paths were updated to relative paths.');
    console.log('Re-run export-sqlite-to-mysql.js to generate an updated SQL file.');
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
