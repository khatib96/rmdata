import fs from 'fs';
import path from 'path';
import sqlite3 from 'sqlite3';

function normalizeApiBase(raw) {
  const base = String(raw || '').trim().replace(/\/+$/, '');
  if (!base) throw new Error('CLOUD_API_BASE is required');
  return base.startsWith('http') ? base : `https://${base}`;
}

function getDbPath() {
  if (process.env.RM_LOCAL_DB_PATH) return process.env.RM_LOCAL_DB_PATH;
  if (process.env.ELECTRON_DB_PATH) return process.env.ELECTRON_DB_PATH;
  const base = process.platform === 'win32'
    ? process.env.APPDATA
    : process.env.HOME && path.join(process.env.HOME, '.config');
  if (base) {
    const candidates = [
      path.join(base, 'RMDATA.System', 'uniform_base.db'),
      path.join(base, 'alredaa-erp-system', 'uniform_base.db'),
    ];
    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  return path.resolve('database/uniform_base.db');
}

function openDb(dbPath) {
  return new sqlite3.Database(dbPath);
}

function dbAll(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

async function login(apiBase, username, password) {
  const res = await fetch(`${apiBase}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.success || !json?.token) {
    throw new Error(json?.error || `Login failed (${res.status})`);
  }
  return json.token;
}

async function getRemoteDocuments(apiBase, token) {
  const res = await fetch(`${apiBase}/api/files/list?includeArchived=1`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.success === false) {
    throw new Error(json?.error || `Remote list failed (${res.status})`);
  }
  return Array.isArray(json?.data) ? json.data : [];
}

async function uploadFile(apiBase, token, payload) {
  const form = new FormData();
  form.append('kind', payload.kind);
  form.append('relativePath', payload.relativePath);
  form.append('file', new Blob([payload.buffer], { type: payload.mimeType || 'application/octet-stream' }), payload.fileName);
  if (payload.customName) form.append('customName', payload.customName);
  if (payload.entityType) form.append('entityType', payload.entityType);
  if (payload.entityId != null) form.append('entityId', String(payload.entityId));
  if (payload.section != null && payload.section !== '') form.append('section', payload.section);
  if (payload.isArchived) form.append('isArchived', '1');

  const res = await fetch(`${apiBase}/api/files/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.success === false) {
    throw new Error(json?.error || `Upload failed (${res.status})`);
  }
  return json;
}

function fileExists(p) {
  try {
    return fs.existsSync(p) && fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

function resolveDocumentFile(userDataRoot, relativePath) {
  const clean = String(relativePath || '').replace(/\\/g, '/').replace(/^\/+/, '');
  const candidates = [
    path.join(userDataRoot, 'documents', ...clean.split('/')),
    path.join(userDataRoot, ...clean.split('/')),
  ];
  return candidates.find(fileExists) || null;
}

function resolveImageFile(userDataRoot, imagePath) {
  if (!imagePath) return null;
  if (path.isAbsolute(imagePath) && fileExists(imagePath)) return imagePath;
  const clean = String(imagePath).replace(/\\/g, '/').replace(/^\/+/, '');
  const candidates = [path.join(userDataRoot, ...clean.split('/'))];
  return candidates.find(fileExists) || null;
}

function docKey(row) {
  return [row.relativePath, row.entityType, row.entityId ?? '', row.section ?? '', row.isArchived ? 1 : 0].join('|');
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

const apiBase = normalizeApiBase(process.env.CLOUD_API_BASE);
const username = process.env.CLOUD_USERNAME || process.env.API_USERNAME;
const password = process.env.CLOUD_PASSWORD || process.env.API_PASSWORD;
if (!username || !password) {
  throw new Error('CLOUD_USERNAME and CLOUD_PASSWORD are required');
}

const dbPath = getDbPath();
const userDataRoot = process.env.RM_USERDATA_PATH || path.dirname(dbPath);
const db = openDb(dbPath);
const token = await login(apiBase, username, password);
const remoteDocs = await getRemoteDocuments(apiBase, token);
const remoteDocKeys = new Set(remoteDocs.map((row) => docKey({
  relativePath: row.relativePath,
  entityType: row.entityType,
  entityId: row.entityId,
  section: row.section,
  isArchived: row.isArchived,
})));

const failures = [];
const migrated = { documents: 0, images: 0, skippedDocuments: 0, skippedImages: 0 };

const localDocs = await dbAll(db, 'SELECT id, relativePath, customName, entityType, entityId, section, isArchived FROM documents ORDER BY id ASC');
for (const row of localDocs) {
  const local = {
    relativePath: row.relativePath,
    customName: row.customName,
    entityType: row.entityType,
    entityId: row.entityId,
    section: row.section,
    isArchived: Number(row.isArchived || 0) === 1,
  };
  const key = docKey(local);
  if (remoteDocKeys.has(key)) {
    migrated.skippedDocuments += 1;
    continue;
  }
  const sourceFile = resolveDocumentFile(userDataRoot, local.relativePath);
  if (!sourceFile) {
    failures.push({ kind: 'document', relativePath: local.relativePath, error: 'LOCAL_FILE_NOT_FOUND' });
    continue;
  }
  try {
    const buffer = fs.readFileSync(sourceFile);
    await uploadFile(apiBase, token, {
      kind: 'document',
      relativePath: local.relativePath,
      fileName: path.basename(sourceFile),
      buffer,
      customName: local.customName,
      entityType: local.entityType,
      entityId: local.entityId,
      section: local.section,
      isArchived: local.isArchived,
    });
    remoteDocKeys.add(key);
    migrated.documents += 1;
  } catch (error) {
    failures.push({ kind: 'document', relativePath: local.relativePath, error: error instanceof Error ? error.message : String(error) });
  }
}

const imageQueries = [
  { table: 'branches', column: 'photoPath' },
  { table: 'employers', column: 'photoPath' },
  { table: 'employees', column: 'imagePath' },
  { table: 'vehicles', column: 'photoPath' },
  { table: 'users', column: 'avatarPath' },
];
const seenImages = new Set();
for (const target of imageQueries) {
  let rows = [];
  try {
    rows = await dbAll(db, `SELECT ${target.column} as filePath FROM ${target.table} WHERE ${target.column} IS NOT NULL AND TRIM(${target.column}) <> ''`);
  } catch {
    continue;
  }
  for (const row of rows) {
    const relativePath = String(row.filePath || '').trim();
    if (!relativePath || seenImages.has(relativePath)) continue;
    seenImages.add(relativePath);
    const sourceFile = resolveImageFile(userDataRoot, relativePath);
    if (!sourceFile) {
      failures.push({ kind: 'image', relativePath, error: 'LOCAL_FILE_NOT_FOUND' });
      continue;
    }
    try {
      const buffer = fs.readFileSync(sourceFile);
      await uploadFile(apiBase, token, {
        kind: 'image',
        relativePath,
        fileName: path.basename(relativePath) || path.basename(sourceFile),
        buffer,
      });
      migrated.images += 1;
    } catch (error) {
      failures.push({ kind: 'image', relativePath, error: error instanceof Error ? error.message : String(error) });
    }
  }
}

db.close();
ensureDir(path.resolve('scripts/migration-logs'));
const reportPath = path.resolve('scripts/migration-logs/local-documents-to-cloud.json');
fs.writeFileSync(reportPath, JSON.stringify({
  dbPath,
  userDataRoot,
  apiBase,
  migrated,
  failures,
  generatedAt: new Date().toISOString(),
}, null, 2));

console.log('Migration completed.');
console.log(JSON.stringify({ migrated, failures: failures.length, reportPath }, null, 2));
