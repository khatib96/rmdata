/**
 * Dev API server — MariaDB (same DB as PHP gateway on VPS).
 * Local: set DB_* and optionally RMDATA_STORAGE_ROOT; run: node server/dev-api-server.js
 * Port 3001 (Vite proxies /api). Electron keeps using local SQLite; this server is remote API only.
 */
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const { sqliteToMysql } = require('./sqlite-to-mysql.js');
const { dbAll, dbRun, pingDb, withTransaction } = require('./mysql-db.js');
const { requirePermission, requireAnyPermission } = require('./permission-middleware.js');
const {
  resolveEffectivePermissions,
  clearAllPermissionCache,
  hasPermission,
} = require('./permissions-resolver.js');
const { syncPermissionCatalogMySQL: seedPermissionCatalog } = require('./permissions-catalog.js');

const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
/** @type {Map<string, { userId: number, exp: number }>} */
const sessions = new Map();
const JWT_SECRET = String(process.env.JWT_SECRET || '').trim();
const JWT_TTL_SECONDS = Number(process.env.JWT_TTL_SECONDS || 43200);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: Math.max(1, Number(process.env.MAX_UPLOAD_MB || 20)) * 1024 * 1024 },
});
const allowedDocumentExtensions = new Set(
  String(process.env.ALLOWED_DOCUMENT_EXTENSIONS || 'pdf,jpg,jpeg,png,gif,webp,svg,txt,doc,docx,xls,xlsx,ppt,pptx')
    .split(',')
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean)
);
const allowedImageExtensions = new Set(
  String(process.env.ALLOWED_IMAGE_EXTENSIONS || 'jpg,jpeg,png,gif,webp,svg')
    .split(',')
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean)
);

function assertDbQueryAllowed(query) {
  const q = String(query || '').trim();
  if (!q) throw new Error('Empty query');
  if (/\b(ATTACH|DETACH|VACUUM|REINDEX)\b/i.test(q)) throw new Error('This SQL operation is not allowed');
  if (/\bPRAGMA\b/i.test(q)) throw new Error('PRAGMA is not allowed');
  const op = getSqlOperation(q);
  if (!['SELECT', 'WITH', 'INSERT', 'UPDATE', 'DELETE', 'REPLACE'].includes(op)) {
    throw new Error('Only SELECT/WITH and legacy allowlisted mutations are allowed');
  }
}

function getSqlOperation(query) {
  const first = String(query || '').trim().split(/\s+/, 1)[0]?.toUpperCase();
  if (['SELECT', 'WITH', 'INSERT', 'UPDATE', 'DELETE', 'REPLACE'].includes(first)) return first;
  return 'OTHER';
}

function extractPrimaryMutationTable(mysqlQuery, trimmedUpper) {
  const raw = String(mysqlQuery || '').replace(/`([^`]+)`/g, '$1');
  let m;
  if (trimmedUpper.startsWith('INSERT') || trimmedUpper.startsWith('REPLACE')) {
    m = /\bINTO\s+([A-Za-z0-9_]+)/i.exec(raw);
    return m ? m[1] : null;
  }
  if (trimmedUpper.startsWith('UPDATE')) {
    m = /\bUPDATE\s+([A-Za-z0-9_]+)/i.exec(raw);
    return m ? m[1] : null;
  }
  if (trimmedUpper.startsWith('DELETE')) {
    m = /\bFROM\s+([A-Za-z0-9_]+)/i.exec(raw);
    return m ? m[1] : null;
  }
  return null;
}

function forbiddenError() {
  const err = new Error('FORBIDDEN');
  err.code = 'FORBIDDEN';
  return err;
}

const LEGACY_DB_QUERY_MUTATION_POLICIES = {
  activity_logs: { authenticated: true },
  connected_devices: { authenticated: true },

  branches: {
    INSERT: [['branches', 'create']],
    UPDATE: [['branches', 'edit'], ['branches', 'archive']],
    DELETE: [['branches', 'delete']],
  },
  branch_licenses: { INSERT: [['branches', 'create'], ['branches', 'edit']], UPDATE: [['branches', 'edit']], DELETE: [['branches', 'delete'], ['branches', 'edit']] },
  branch_leases: { INSERT: [['branches', 'create'], ['branches', 'edit']], UPDATE: [['branches', 'edit']], DELETE: [['branches', 'delete'], ['branches', 'edit']] },
  branch_establishments: { INSERT: [['branches', 'create'], ['branches', 'edit']], UPDATE: [['branches', 'edit']], DELETE: [['branches', 'delete'], ['branches', 'edit']] },
  branch_custom_fields: { INSERT: [['branches', 'create'], ['branches', 'edit']], UPDATE: [['branches', 'edit']], DELETE: [['branches', 'delete'], ['branches', 'edit']] },
  lease_installments: { INSERT: [['branches', 'create'], ['branches', 'edit']], UPDATE: [['branches', 'edit']], DELETE: [['branches', 'delete'], ['branches', 'edit']] },

  employees: {
    INSERT: [['employees', 'create']],
    UPDATE: [['employees', 'edit']],
    DELETE: [['employees', 'delete']],
  },
  status_history: { INSERT: [['employees', 'edit'], ['employees', 'action.changeStatus']], UPDATE: [['employees', 'edit'], ['employees', 'action.changeStatus']], DELETE: [['employees', 'delete'], ['employees', 'edit']] },
  employee_status_history: { INSERT: [['employees', 'edit'], ['employees', 'action.changeStatus']], UPDATE: [['employees', 'edit'], ['employees', 'action.changeStatus']], DELETE: [['employees', 'delete'], ['employees', 'edit']] },

  employers: { INSERT: [['employers', 'create']], UPDATE: [['employers', 'edit']], DELETE: [['employers', 'delete']] },
  branch_employers: { INSERT: [['employers', 'edit'], ['branches', 'edit']], UPDATE: [['employers', 'edit'], ['branches', 'edit']], DELETE: [['employers', 'edit'], ['branches', 'edit']] },

  vehicles: { INSERT: [['vehicles', 'create']], UPDATE: [['vehicles', 'edit']], DELETE: [['vehicles', 'delete']] },
  vehicle_custom_fields: { INSERT: [['vehicles', 'create'], ['vehicles', 'edit']], UPDATE: [['vehicles', 'edit']], DELETE: [['vehicles', 'delete'], ['vehicles', 'edit']] },

  phones: { INSERT: [['phones', 'create']], UPDATE: [['phones', 'edit']], DELETE: [['phones', 'delete']] },

  housing_units: { INSERT: [['housing', 'create']], UPDATE: [['housing', 'edit']], DELETE: [['housing', 'delete']] },
  housing_installments: { INSERT: [['housing', 'create'], ['housing', 'edit']], UPDATE: [['housing', 'edit']], DELETE: [['housing', 'delete'], ['housing', 'edit']] },
  housing_occupants: { INSERT: [['housing', 'edit']], UPDATE: [['housing', 'edit']], DELETE: [['housing', 'edit'], ['housing', 'delete']] },
  housing_custom_fields: { INSERT: [['housing', 'create'], ['housing', 'edit']], UPDATE: [['housing', 'edit']], DELETE: [['housing', 'delete'], ['housing', 'edit']] },

  entities: { INSERT: [['entities', 'create']], UPDATE: [['entities', 'edit']], DELETE: [['entities', 'delete']] },
  documents: { INSERT: [['documents', 'create']], UPDATE: [['documents', 'edit'], ['documents', 'delete']], DELETE: [['documents', 'delete']] },
  notifications: {
    INSERT: [['settings', 'edit'], ['logs', 'view'], ['employees', 'edit'], ['branches', 'edit'], ['vehicles', 'edit'], ['phones', 'edit'], ['housing', 'edit'], ['employers', 'edit'], ['entities', 'edit']],
    UPDATE: [['settings', 'edit'], ['logs', 'view'], ['employees', 'edit'], ['branches', 'edit'], ['vehicles', 'edit'], ['phones', 'edit'], ['housing', 'edit'], ['employers', 'edit'], ['entities', 'edit']],
    DELETE: [['settings', 'edit'], ['logs', 'view'], ['employees', 'edit'], ['branches', 'edit'], ['vehicles', 'edit'], ['phones', 'edit'], ['housing', 'edit'], ['employers', 'edit'], ['entities', 'edit']],
  },
  settings: { INSERT: [['settings', 'edit']], UPDATE: [['settings', 'edit']], DELETE: [['settings', 'delete'], ['settings', 'edit']] },

  users: { INSERT: [['settings', 'users.create'], ['users', 'create']], UPDATE: [['settings', 'users.edit'], ['users', 'edit']], DELETE: [['settings', 'users.delete'], ['users', 'delete']] },
  permissions: { adminOnly: true },
  user_permissions: { INSERT: [['settings', 'edit']], UPDATE: [['settings', 'edit']], DELETE: [['settings', 'edit']] },
  user_permission_overrides: { INSERT: [['settings', 'edit']], UPDATE: [['settings', 'edit']], DELETE: [['settings', 'edit']] },
  role_permissions: { INSERT: [['settings', 'edit']], UPDATE: [['settings', 'edit']], DELETE: [['settings', 'edit']] },
};

async function hasAnyPermission(userId, candidates) {
  for (const [module, action] of candidates || []) {
    if (await hasPermission(userId, module, action)) return true;
  }
  return false;
}

function logLegacyDbQueryMutation(userId, operation, table, sql) {
  const compactSql = String(sql || '').replace(/\s+/g, ' ').trim().slice(0, 240);
  console.warn(`[legacy-db-query] mutation user=${Number(userId) || 'unknown'} operation=${operation} table=${table || 'unknown'} sql="${compactSql}"`);
}

/** يطابق العميل: branches.edit + (manage | action.uploadBranchDocuments) */
async function canUploadBranchDocuments(userId) {
  const uid = Number(userId);
  if (!uid) return false;
  if (await hasPermission(uid, 'branches', 'manage')) return true;
  return hasPermission(uid, 'branches', 'action.uploadBranchDocuments');
}

/** يطابق العميل: branches.edit + (manage | action.deleteBranchDocuments) */
async function canDeleteBranchDocuments(userId) {
  const uid = Number(userId);
  if (!uid) return false;
  if (await hasPermission(uid, 'branches', 'manage')) return true;
  return hasPermission(uid, 'branches', 'action.deleteBranchDocuments');
}

/** حماية db/query: جداول حساسة تتطلب نفس نية REST تقريباً */
async function assertDbQueryMutationAuthorized(trimmedUpper, mysqlQuery, userId) {
  if (!isMutatingSql(trimmedUpper)) return;
  const uid = Number(userId);
  if (!uid) throw forbiddenError();

  const table = extractPrimaryMutationTable(mysqlQuery, trimmedUpper);
  if (!table) throw forbiddenError();
  const t = String(table).toLowerCase();
  const operation = getSqlOperation(trimmedUpper);
  const policy = LEGACY_DB_QUERY_MUTATION_POLICIES[t];
  if (!policy) throw forbiddenError();
  if (policy.authenticated) return;
  if (policy.adminOnly) {
    const { isAdmin } = await resolveEffectivePermissions(uid);
    if (!isAdmin) throw forbiddenError();
    return;
  }

  const candidates = policy[operation] || [];
  if (!candidates.length || !(await hasAnyPermission(uid, candidates))) throw forbiddenError();
}

async function tryLogPermissionAudit(actorUserId, mysqlQuery, trimmedUpperSql) {
  const uid = Number(actorUserId);
  if (!uid || !isMutatingSql(trimmedUpperSql)) return;
  const q = String(mysqlQuery || '').toLowerCase();
  const touches =
    q.includes(' user_permissions ') ||
    q.includes(' user_permission_overrides ') ||
    q.includes(' role_permissions ') ||
    (trimmedUpperSql.startsWith('INSERT') && q.includes(' into permissions')) ||
    (trimmedUpperSql.startsWith('UPDATE') && q.includes(' permissions ')) ||
    (trimmedUpperSql.startsWith('DELETE') && q.includes(' permissions '));
  if (!touches) return;
  const details = String(mysqlQuery || '').slice(0, 500);
  try {
    await dbRun('INSERT INTO permission_audit_logs (actorUserId, action, details) VALUES (?, ?, ?)', [
      uid,
      'PERMISSION_MAPPING_CHANGE',
      details,
    ]);
  } catch {
    /* جدول اختياري */
  }
}

function isMutatingSql(trimmedUpperSql) {
  return (
    trimmedUpperSql.startsWith('INSERT') ||
    trimmedUpperSql.startsWith('UPDATE') ||
    trimmedUpperSql.startsWith('DELETE') ||
    trimmedUpperSql.startsWith('REPLACE')
  );
}

/**
 * Phase A-3: invalidate permission cache/version on permission mutations.
 * Conservative strategy for now: global bump when permission mapping tables are mutated.
 */
async function handlePermissionMutationSideEffects(mysqlQuery, trimmedUpperSql, actorUserId) {
  if (!isMutatingSql(trimmedUpperSql)) return;
  const q = String(mysqlQuery || '').toLowerCase();
  const touchesPermissionMapping =
    q.includes(' user_permissions ') ||
    q.includes(' user_permission_overrides ') ||
    q.includes(' role_permissions ') ||
    q.includes(' permissions ');
  const updatesUserRole = q.includes(' update users ') && q.includes(' roleid');
  if (!touchesPermissionMapping && !updatesUserRole) return;
  await tryLogPermissionAudit(actorUserId, mysqlQuery, trimmedUpperSql);
  await dbRun('UPDATE users SET permissionVersion = permissionVersion + 1, updatedAt = NOW()');
  clearAllPermissionCache();
}

function createSession(user) {
  const uid = Number(user?.id || 0);
  const roleId = Number(user?.roleId || 0);
  const roleName = String(user?.roleName || '');
  const username = String(user?.username || '');
  if (JWT_SECRET) {
    return jwt.sign(
      { sub: uid, username, roleId, roleName },
      JWT_SECRET,
      { algorithm: 'HS256', expiresIn: Math.max(300, JWT_TTL_SECONDS), issuer: process.env.JWT_ISSUER || 'rmdata-node-api' }
    );
  }
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { userId: uid, exp: Date.now() + SESSION_TTL_MS });
  return token;
}

function normalizeRelativePath(rel) {
  const raw = String(rel || '').replace(/\\/g, '/').replace(/^\/+/, '').trim();
  if (!raw || raw.includes('..')) throw new Error('INVALID_PATH');
  return raw.split('/').filter(Boolean).join('/');
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

/**
 * MariaDB strict mode rejects ISO strings like 2025-01-13T00:00:00.000Z for DATE/DATETIME columns.
 * Convert them before query execution (Z, numeric offsets, Date objects).
 */
function sqlParamToMysqlDateTime(d) {
  const y = d.getUTCFullYear();
  const mo = pad2(d.getUTCMonth() + 1);
  const day = pad2(d.getUTCDate());
  const hh = d.getUTCHours();
  const mm = d.getUTCMinutes();
  const ss = d.getUTCSeconds();
  if (hh === 0 && mm === 0 && ss === 0) return `${y}-${mo}-${day}`;
  return `${y}-${mo}-${day} ${pad2(hh)}:${pad2(mm)}:${pad2(ss)}`;
}

function normalizeSqlParamValue(v) {
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return sqlParamToMysqlDateTime(v);
  }
  if (typeof v !== 'string') return v;
  const s = v.trim();
  if (!s) return v;
  // ISO-8601 with time part (Z or ±offset); avoid touching plain "YYYY-MM-DD" or arbitrary strings.
  if (!/^\d{4}-\d{2}-\d{2}T/.test(s)) return v;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return v;
  return sqlParamToMysqlDateTime(d);
}

function normalizeSqlParams(params) {
  return params.map((x) => normalizeSqlParamValue(x));
}

function resolveStoragePathForWrite(rel) {
  const normalizedRel = normalizeRelativePath(rel);
  const segments = getStoragePathSegments(normalizedRel);
  if (!segments) throw new Error('INVALID_PATH');
  const full = path.normalize(path.join(storageRoot, ...segments));
  const rootNorm = path.normalize(storageRoot);
  if (!full.startsWith(rootNorm + path.sep) && full !== rootNorm) throw new Error('INVALID_PATH');
  return { normalizedRel, full };
}

function fileMimeType(filePath, fallbackName) {
  const ext = path.extname(filePath || fallbackName || '').toLowerCase();
  const map = {
    '.pdf': 'application/pdf',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.txt': 'text/plain; charset=utf-8',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.ppt': 'application/vnd.ms-powerpoint',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  };
  return map[ext] || 'application/octet-stream';
}

function assertAllowedExtension(fileName, kind) {
  const ext = path.extname(String(fileName || '')).toLowerCase().replace(/^\./, '');
  if (!ext) throw new Error('INVALID_EXTENSION');
  if (kind === 'image' && !allowedImageExtensions.has(ext)) throw new Error('INVALID_EXTENSION');
  if (kind !== 'image' && !allowedDocumentExtensions.has(ext)) throw new Error('INVALID_EXTENSION');
}

function getSessionFromReq(req) {
  let token = null;
  const h = req.headers.authorization || '';
  const m = /^Bearer\s+(\S+)$/i.exec(h);
  if (m) token = m[1];
  if (!token && typeof req.query?.token === 'string' && req.query.token.length > 0) {
    token = req.query.token;
  }
  if (!token) return null;
  if (JWT_SECRET) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
      const uid = Number(decoded?.sub || 0);
      if (uid > 0) return { token, userId: uid };
    } catch {
      // Fallback to legacy in-memory sessions for gradual migration.
    }
  }
  const s = sessions.get(token);
  if (!s || s.exp < Date.now()) {
    sessions.delete(token);
    return null;
  }
  return { token, userId: s.userId };
}

function requireAuth(req, res, next) {
  const s = getSessionFromReq(req);
  if (!s) {
    return res.status(401).json({ success: false, error: 'UNAUTHORIZED' });
  }
  req.authSession = s;
  next();
}

/** RMDATA_STORAGE_ROOT: فقط مجلدان في الجذر — documents/ و images/ (المستندات التشغيلية تحت documents/). */
function getStorageRoot() {
  if (process.env.RMDATA_STORAGE_ROOT) {
    return path.normalize(path.resolve(process.env.RMDATA_STORAGE_ROOT));
  }
  if (process.env.NODE_ENV === 'production') {
    console.error('RMDATA_STORAGE_ROOT is required in production');
    process.exit(1);
  }
  return path.normalize(path.resolve(__dirname, '../api-gateway-php/storage'));
}

const storageRoot = getStorageRoot();

/** First segment under images/… — typical lowercase subfolders on disk */
const IMAGES_SUB = {
  branches: 'branches',
  employees: 'employees',
  employers: 'employers',
  housing: 'housing',
  vehicles: 'vehicles',
  settings: 'settings',
};

/** Under documents/… only (e.g. documents/phase-b/…) */
const DOCUMENTS_SUB = {
  ...IMAGES_SUB,
  'phase-b': 'phase-b',
};

/**
 * @param {string[]} parts relative segments (no leading images|documents)
 * @param {Record<string, string>} map
 */
function normalizeKnownSubfolder(parts, map) {
  if (!parts.length) return parts;
  const first = parts[0];
  const key = first.toLowerCase();
  const canon = Object.prototype.hasOwnProperty.call(map, key) ? map[key] : first;
  return [canon, ...parts.slice(1)];
}

/**
 * مسارات قاعدة البيانات مثل Branches/… — على القرص: storage/documents/Branches/…
 */
const ENTITY_ROOT_FOLDER = {
  branches: 'Branches',
  employees: 'Employees',
  housing: 'Housing',
  vehicles: 'Vehicles',
  employers: 'Employers',
  archive: 'Archive',
  taxes: 'Taxes',
  settings: 'Settings',
};

function normalizeEntityRootParts(parts) {
  if (!parts.length) return parts;
  const first = parts[0];
  const key = first.toLowerCase();
  const mapped = Object.prototype.hasOwnProperty.call(ENTITY_ROOT_FOLDER, key) ? ENTITY_ROOT_FOLDER[key] : first;
  return [mapped, ...parts.slice(1)];
}

/**
 * @returns {string[] | null} path segments under RMDATA_STORAGE_ROOT (always starts with images or documents)
 */
function getStoragePathSegments(rel) {
  const raw = String(rel || '').trim().replace(/\\/g, '/').replace(/^\/+/, '');
  if (!raw || raw.includes('..')) return null;
  const parts = raw.split('/').filter(Boolean);
  if (!parts.length) return null;
  const head = parts[0].toLowerCase();
  if (head === 'images') {
    return ['images', ...normalizeKnownSubfolder(parts.slice(1), IMAGES_SUB)];
  }
  if (head === 'documents') {
    return ['documents', ...normalizeKnownSubfolder(parts.slice(1), DOCUMENTS_SUB)];
  }
  return ['documents', ...normalizeEntityRootParts(parts)];
}

/**
 * Resolve file — path traversal blocked.
 * - images/… → storage/images/…
 * - documents/… → storage/documents/…
 * - Branches|Employees|…/… → storage/documents/Branches|…/…
 */
function resolveStorageFile(rel) {
  const segments = getStoragePathSegments(rel);
  if (!segments) return null;
  const full = path.normalize(path.join(storageRoot, ...segments));
  const rootNorm = path.normalize(storageRoot);
  if (!full.startsWith(rootNorm + path.sep) && full !== rootNorm) return null;
  if (!fs.existsSync(full) || !fs.statSync(full).isFile()) return null;
  return full;
}

function mimeFromExt(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const map = {
    '.pdf': 'application/pdf',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.txt': 'text/plain; charset=utf-8',
  };
  return map[ext] || 'application/octet-stream';
}

const express = require('express');
const app = express();
app.use(express.json({ limit: '2mb' }));

app.use((_req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
});

// Express 5 path-to-regexp rejects '/api/*' (unnamed wildcard); regex matches /api and /api/...
app.options(/^\/api(?:\/.*)?$/, (_req, res) => res.sendStatus(204));

app.get('/api/health', async (_req, res) => {
  try {
    await pingDb();
    res.json({ ok: true, database: true });
  } catch (e) {
    res.status(503).json({ ok: false, database: false, error: 'DB_UNAVAILABLE' });
  }
});

// POST /api/db/query — same contract as Electron db:query; translate SQLite SQL like PHP gateway
app.post('/api/db/query', requireAuth, async (req, res) => {
  try {
    const { query, params } = req.body || {};
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ success: false, error: 'Missing query' });
    }
    assertDbQueryAllowed(query);
    const mysqlQuery = sqliteToMysql(query);
    const args = Array.isArray(params) ? normalizeSqlParams(params) : [];
    const trimmed = mysqlQuery.trim().toUpperCase();
    const isSelect = trimmed.startsWith('SELECT') || trimmed.startsWith('WITH');

    if (isSelect) {
      try {
        const rows = await dbAll(mysqlQuery, args);
        res.json({ success: true, data: rows || [] });
      } catch (err) {
        console.error('Query error:', err);
        res.json({ success: false, error: err instanceof Error ? err.message : String(err) });
      }
      return;
    }

    try {
      await assertDbQueryMutationAuthorized(trimmed, mysqlQuery, req.authSession.userId);
      const result = await dbRun(mysqlQuery, args);
      await handlePermissionMutationSideEffects(mysqlQuery, trimmed, req.authSession.userId);
      const resource = (mysqlQuery.match(/\b(?:INTO|UPDATE|FROM)\s+(\w+)/i) || [])[1] || 'unknown';
      const event = trimmed.startsWith('INSERT') ? 'created' : trimmed.startsWith('DELETE') ? 'deleted' : 'updated';
      broadcastDataChange(event, resource, result.lastID || null);
      res.json({
        success: true,
        data: [],
        lastInsertId: trimmed.startsWith('INSERT') ? (result.lastID || null) : undefined,
        changes: result.changes,
      });
    } catch (err) {
      console.error('Query error:', err);
      res.json({ success: false, error: err instanceof Error ? err.message : String(err) });
    }
  } catch (e) {
    const code = e && typeof e === 'object' && 'code' in e && e.code === 'FORBIDDEN' ? 'FORBIDDEN' : null;
    const msg = e instanceof Error ? e.message : String(e);
    return res.status(403).json({ success: false, error: code || msg });
  }
});

// POST /api/auth/login â€” ظ…ظƒط§ظپط¦ ظ„ظ€ ipcMain auth:login (ط¨ط¯ظˆظ† طھط³ط¬ظٹظ„ ط¨ظٹط§ظ†ط§طھ ط­ط³ط§ط³ط©)
app.post('/api/auth/login', async (req, res) => {
  try {
    const username = String(req.body?.username || '').trim();
    const password = String(req.body?.password || '');

    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'INVALID_CREDENTIALS' });
    }

    const users = await dbAll(
      `SELECT u.id, u.username, u.passwordHash, u.fullName, u.email, u.roleId, u.isActive,
              u.userType, u.linkedEntityType, u.linkedEntityId, u.mustChangePassword, u.avatarPath,
              COALESCE(u.permissionVersion, 1) AS permissionVersion,
              r.name as roleName
       FROM users u
       LEFT JOIN roles r ON u.roleId = r.id
       LEFT JOIN employees e ON u.linkedEntityType = 'employee' AND e.id = u.linkedEntityId
       LEFT JOIN employers em ON u.linkedEntityType = 'employer' AND em.id = u.linkedEntityId
       WHERE LOWER(TRIM(u.username)) = LOWER(?)
          OR (e.id IS NOT NULL AND LOWER(TRIM(e.code)) = LOWER(?))
          OR (em.id IS NOT NULL AND LOWER(TRIM(em.code)) = LOWER(?))
       LIMIT 1`,
      [username, username, username]
    );

    const user = users?.[0];
    if (!user || !user.passwordHash) {
      return res.json({ success: false, error: 'INVALID_CREDENTIALS' });
    }
    if (Number(user.isActive) !== 1) {
      return res.json({ success: false, error: 'ACCOUNT_DISABLED' });
    }

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      return res.json({ success: false, error: 'INVALID_CREDENTIALS' });
    }

    await dbRun("UPDATE users SET lastLoginAt = NOW(), updatedAt = NOW() WHERE id = ?", [user.id]);

    let linkedEntityName;
    let linkedEntityImagePath;
    let linkedBranchName;
    let linkedProfession;

    if (user.linkedEntityType === 'employee' && user.linkedEntityId) {
      const emp = await dbAll(
        'SELECT e.name, e.imagePath, e.profession, b.name as branchName FROM employees e LEFT JOIN branches b ON e.workBranchId = b.id WHERE e.id = ?',
        [user.linkedEntityId]
      );
      const row = emp?.[0];
      if (row) {
        linkedEntityName = row.name;
        linkedEntityImagePath = row.imagePath;
        linkedBranchName = row.branchName;
        linkedProfession = row.profession;
      }
    } else if (user.linkedEntityType === 'employer' && user.linkedEntityId) {
      const empr = await dbAll('SELECT fullName as name, photoPath as imagePath FROM employers WHERE id = ?', [user.linkedEntityId]);
      const row = empr?.[0];
      if (row) {
        linkedEntityName = row.name;
        linkedEntityImagePath = row.imagePath;
      }
    }

    const token = createSession(user);
    let effPerms = { entries: [], permissionVersion: Number(user.permissionVersion) || 1 };
    try {
      effPerms = await resolveEffectivePermissions(user.id);
    } catch (permErr) {
      console.error('resolveEffectivePermissions at login:', permErr instanceof Error ? permErr.message : String(permErr));
    }

    return res.json({
      success: true,
      token,
      permissionVersion: effPerms.permissionVersion,
      effectivePermissions: effPerms.entries,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        email: user.email || '',
        roleId: user.roleId,
        roleName: user.roleName || 'Admin',
        userType: user.userType === 'linked' ? 'linked' : 'free',
        linkedEntityType: user.linkedEntityType === 'employee' ? 'employee' : user.linkedEntityType === 'employer' ? 'employer' : undefined,
        linkedEntityId: user.linkedEntityId,
        linkedEntityName,
        linkedEntityImagePath,
        linkedBranchName,
        linkedProfession,
        mustChangePassword: Number(user.mustChangePassword) === 1,
        avatarPath: user.avatarPath || null,
        permissionVersion: effPerms.permissionVersion,
      },
    });
  } catch (err) {
    console.error('Auth login error (no credentials logged):', err instanceof Error ? err.message : String(err));
    return res.json({ success: false, error: 'LOGIN_FAILED' });
  }
});

// POST /api/auth/change-own-password â€” ظ…ظƒط§ظپط¦ ظ„ظ€ ipcMain auth:changeOwnPassword (ط¨ط¯ظˆظ† طھط³ط¬ظٹظ„ ط¨ظٹط§ظ†ط§طھ ط­ط³ط§ط³ط©)
app.post('/api/auth/change-own-password', requireAuth, async (req, res) => {
  try {
    const userId = Number(req.body?.userId);
    const currentPassword = String(req.body?.currentPassword || '');
    const newPassword = String(req.body?.newPassword || '');

    if (!Number.isFinite(userId) || userId <= 0 || !currentPassword || !newPassword) {
      return res.status(400).json({ success: false, error: 'INVALID_REQUEST' });
    }
    if (userId !== req.authSession.userId) {
      return res.status(403).json({ success: false, error: 'FORBIDDEN' });
    }

    const users = await dbAll('SELECT id, passwordHash FROM users WHERE id = ? LIMIT 1', [userId]);
    const user = users?.[0];
    if (!user?.passwordHash) {
      return res.json({ success: false, error: 'USER_NOT_FOUND' });
    }

    const match = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!match) {
      return res.json({ success: false, error: 'INVALID_CURRENT_PASSWORD' });
    }

    const hash = bcrypt.hashSync(newPassword, 10);
    await dbRun(
      "UPDATE users SET passwordHash = ?, mustChangePassword = 0, passwordChangedAt = NOW(), updatedAt = NOW() WHERE id = ?",
      [hash, userId]
    );

    return res.json({ success: true });
  } catch (err) {
    console.error(
      'Change own password error (no credentials logged):',
      err instanceof Error ? err.message : String(err)
    );
    return res.json({ success: false, error: 'CHANGE_PASSWORD_FAILED' });
  }
});

/**
 * ط¨ط« ظ…ظ„ظپ ظ…ظ† ظ…ط¬ظ„ط¯ ط¨ظٹط§ظ†ط§طھ ط§ظ„طھط·ط¨ظٹظ‚ (documents/ ط£ظˆ images/) ط¨ط¹ط¯ ط§ظ„ظ…طµط§ط¯ظ‚ط©.
 * ظٹط¯ط¹ظ… token ظپظٹ ط§ظ„ط§ط³طھط¹ظ„ط§ظ… ظ„ط£ظ† ظˆط³ظˆظ… <img src> ظ„ط§ طھط±ط³ظ„ ط±ط£ط³ Authorization.
 * ط§ظ„ط§ط³طھط®ط¯ط§ظ…: ط£ط¬ظ‡ط²ط© ط£ط®ط±ظ‰ ط¹ظ„ظ‰ ط§ظ„ط´ط¨ظƒط© ط§ظ„ظ…ط­ظ„ظٹط© طھظپطھط­ ط§ظ„ظˆط§ط¬ظ‡ط© ط¹ظ„ظ‰ :5173 ظˆطھط¹ط±ط¶ ظ†ظپط³ ط§ظ„ظ…ظ„ظپط§طھ ط§ظ„ظ…ط®ط²ظ†ط© ط¹ظ„ظ‰ ط¬ظ‡ط§ط² ط§ظ„ط®ط§ط¯ظ….
 */
app.get('/api/files/serve', requireAuth, requirePermission('documents', 'view'), (req, res) => {
  const rel = req.query.rel;
  if (typeof rel !== 'string' || !rel.trim()) {
    return res.status(400).send('Missing rel');
  }
  const full = resolveStorageFile(rel);
  if (!full) {
    return res.status(404).send('Not found');
  }
  res.setHeader('Content-Type', mimeFromExt(full));
  res.setHeader('Cache-Control', 'private, max-age=3600');
  res.sendFile(full, (err) => {
    if (err && !res.headersSent) res.status(500).end();
  });
});

app.get('/api/files/open', requireAuth, requirePermission('documents', 'view'), (req, res) => {
  const rel = req.query.path;
  if (typeof rel !== 'string' || !rel.trim()) {
    return res.status(400).json({ success: false, error: 'Missing path' });
  }
  const full = resolveStorageFile(rel);
  if (!full) {
    return res.status(404).json({ success: false, error: 'Not found' });
  }
  res.setHeader('Content-Type', mimeFromExt(full));
  res.setHeader('Cache-Control', 'private, max-age=3600');
  res.sendFile(full, (err) => {
    if (err && !res.headersSent) res.status(500).end();
  });
});

app.get('/api/files/list', requireAuth, requirePermission('documents', 'view'), async (req, res) => {
  try {
    let query = 'SELECT id, relativePath, customName, entityType, entityId, section, createdAt FROM documents WHERE (isArchived = 0 OR isArchived IS NULL)';
    const params = [];
    if (typeof req.query.entityType === 'string' && req.query.entityType.trim()) {
      query += ' AND entityType = ?';
      params.push(req.query.entityType.trim());
    }
    if (typeof req.query.entityId === 'string' && req.query.entityId.trim()) {
      query += ' AND entityId = ?';
      params.push(Number(req.query.entityId));
    }
    if (typeof req.query.section === 'string' && req.query.section.trim()) {
      query += ' AND section = ?';
      params.push(req.query.section.trim());
    }
    query += ' ORDER BY createdAt DESC';
    const rows = await dbAll(query, params);
    res.json({ success: true, data: rows || [] });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

app.post('/api/files/upload', requireAuth, requirePermission('documents', 'create'), upload.single('file'), async (req, res) => {
  try {
    const kind = String(req.body?.kind || 'document').trim().toLowerCase();
    const relativePath = String(req.body?.relativePath || '');
    const customName = req.body?.customName ? String(req.body.customName).trim() : null;
    const entityType = req.body?.entityType ? String(req.body.entityType).trim() : null;
    const entityId = req.body?.entityId != null && String(req.body.entityId).trim() !== '' ? Number(req.body.entityId) : null;
    const section = req.body?.section != null && String(req.body.section).trim() !== '' ? String(req.body.section).trim() : null;
    const isArchived = req.body?.isArchived === '1' || req.body?.isArchived === 'true' || req.body?.isArchived === true;
    const skipDbInsert = req.body?.skipDbInsert === '1' || req.body?.skipDbInsert === 'true' || req.body?.skipDbInsert === true;

    if (!req.file) return res.status(400).json({ success: false, error: 'MISSING_FILE' });
    if (!req.file.size || req.file.size <= 0) return res.status(400).json({ success: false, error: 'MISSING_FILE' });
    assertAllowedExtension(req.file.originalname || req.file.fieldname, kind === 'image' ? 'image' : 'document');

    const { normalizedRel, full: targetPath } = resolveStoragePathForWrite(relativePath);
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });

    if (kind === 'image' || skipDbInsert) {
      fs.writeFileSync(targetPath, req.file.buffer);
      return res.json({
        success: true,
        relativePath: normalizedRel,
        mimeType: fileMimeType(targetPath, req.file.originalname),
        sizeBytes: fs.statSync(targetPath).size,
      });
    }

    if (!entityType) return res.status(400).json({ success: false, error: 'MISSING_ENTITY_TYPE' });
    const entityTypeNorm = String(entityType).trim().toLowerCase();
    if (entityTypeNorm === 'branch') {
      const uid = req.authSession?.userId;
      const editOk = await hasPermission(uid, 'branches', 'edit');
      if (!editOk) return res.status(403).json({ success: false, error: 'FORBIDDEN' });
      if (!(await canUploadBranchDocuments(uid))) return res.status(403).json({ success: false, error: 'FORBIDDEN' });
    }
    try {
      fs.writeFileSync(targetPath, req.file.buffer);
      const mimeType = fileMimeType(targetPath, req.file.originalname);
      const sizeBytes = fs.statSync(targetPath).size;
      const insertResult = await withTransaction(async (tx) => {
        if (!isArchived) {
          const existingRows = await tx.all(
            `SELECT id, relativePath, customName
               FROM documents
              WHERE entityType = ?
                AND ((? IS NULL AND entityId IS NULL) OR entityId = ?)
                AND ((? IS NULL AND section IS NULL) OR section = ?)
                AND (isArchived = 0 OR isArchived IS NULL)
              ORDER BY id DESC
              LIMIT 1`,
            [entityType, entityId, entityId, section, section]
          );
          const existing = existingRows?.[0];
          if (existing?.relativePath) {
            const oldRel = String(existing.relativePath);
            const oldFull = resolveStorageFile(oldRel) || resolveStoragePathForWrite(oldRel).full;
            if (fs.existsSync(oldFull) && fs.statSync(oldFull).isFile()) {
              const archiveDate = new Date().toISOString().slice(0, 10).replace(/-/g, '_');
              const dirPart = path.dirname(oldRel).replace(/\\/g, '/').replace(/^\.$/, '');
              const base = path.basename(oldRel);
              const ext = path.extname(base);
              const nameNoExt = path.basename(base, ext) || 'doc';
              const archiveRel = `Archive/${dirPart !== '' ? `${dirPart}/` : ''}Old_${nameNoExt}_${archiveDate}${ext}`;
              const archiveFull = resolveStoragePathForWrite(archiveRel).full;
              fs.mkdirSync(path.dirname(archiveFull), { recursive: true });
              fs.renameSync(oldFull, archiveFull);
              await tx.run('UPDATE documents SET relativePath = ?, customName = ?, isArchived = 1 WHERE id = ?', [
                archiveRel,
                `${existing.customName || base} (Archived)`,
                Number(existing.id),
              ]);
            }
          }
        }
        return tx.run(
          `INSERT INTO documents
           (relativePath, customName, originalFileName, entityType, entityId, section, mimeType, sizeBytes, uploadedByUserId, isArchived)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            normalizedRel,
            customName || path.basename(normalizedRel),
            req.file.originalname || path.basename(normalizedRel),
            entityType,
            entityId,
            section,
            mimeType,
            sizeBytes,
            req.authSession.userId,
            isArchived ? 1 : 0,
          ]
        );
      });
      return res.json({
        success: true,
        id: insertResult.lastID,
        relativePath: normalizedRel,
        mimeType,
        sizeBytes,
      });
    } catch (err) {
      if (fs.existsSync(targetPath)) {
        try { fs.unlinkSync(targetPath); } catch {}
      }
      throw err;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === 'LIMIT_FILE_SIZE') return res.status(413).json({ success: false, error: 'FILE_TOO_LARGE' });
    if (msg === 'INVALID_EXTENSION') return res.status(400).json({ success: false, error: 'INVALID_EXTENSION' });
    if (msg === 'INVALID_PATH') return res.status(400).json({ success: false, error: 'INVALID_PATH' });
    return res.status(500).json({ success: false, error: 'UPLOAD_FAILED' });
  }
});

app.post('/api/files/delete', requireAuth, requirePermission('documents', 'delete'), async (req, res) => {
  try {
    const id = Number(req.body?.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ success: false, error: 'INVALID_ID' });
    }
    const rows = await dbAll('SELECT relativePath, entityType FROM documents WHERE id = ? LIMIT 1', [id]);
    const row = rows?.[0];
    if (!row?.relativePath) {
      return res.status(404).json({ success: false, error: 'NOT_FOUND' });
    }
    if (row.entityType && String(row.entityType).trim().toLowerCase() === 'branch') {
      const uid = req.authSession?.userId;
      const editOk = await hasPermission(uid, 'branches', 'edit');
      if (!editOk) return res.status(403).json({ success: false, error: 'FORBIDDEN' });
      if (!(await canDeleteBranchDocuments(uid))) return res.status(403).json({ success: false, error: 'FORBIDDEN' });
    }
    await dbRun('DELETE FROM documents WHERE id = ?', [id]);
    const full = resolveStorageFile(row.relativePath);
    if (full && fs.existsSync(full)) fs.unlinkSync(full);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// REST API — per-module endpoints (Phase 2 — for mobile / web clients)
// Each resource follows the same pattern:
//   GET    /api/:resource           → list (supports ?search=, ?isArchived=, ?branchId=)
//   GET    /api/:resource/:id       → single record
//   POST   /api/:resource           → create
//   PUT    /api/:resource/:id       → update
//   DELETE /api/:resource/:id       → archive (soft-delete) or hard delete
// ═══════════════════════════════════════════════════════════════════════════════

// ── Generic helpers ───────────────────────────────────────────────────────────

function safeInt(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

// Broadcast a data change event to all subscribed WS clients.
// Called after every mutating REST operation.
// wsBroadcast is a function declaration at module scope — safe to call before its textual position.
function broadcastDataChange(event, resource, id) {
  wsBroadcast('data', { event, resource, id });
}

// Build a simple WHERE fragment from query params.
// Allowed filters per resource are specified by the caller.
function buildWhere(queryParams, allowed) {
  const clauses = [];
  const params = [];
  for (const [key, col] of Object.entries(allowed)) {
    const val = queryParams[key];
    if (val !== undefined && val !== '') {
      clauses.push(`${col} = ?`);
      params.push(typeof val === 'string' ? val : String(val));
    }
  }
  return { where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', params };
}

async function restoreArchivedResource(req, res, config) {
  const id = safeInt(req.params.id);
  if (!id) return res.status(400).json({ success: false, error: 'INVALID_ID' });
  try {
    const existing = await dbAll(`SELECT id FROM ${config.table} WHERE id = ? LIMIT 1`, [id]);
    if (!existing.length) return res.status(404).json({ success: false, error: 'NOT_FOUND' });
    await dbRun(`UPDATE ${config.table} SET status = 'active', updatedAt = NOW() WHERE id = ?`, [id]);
    broadcastDataChange('updated', config.resource, id);
    res.json({ success: true, data: { entityType: config.entityType } });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
}

async function archiveResource(req, res, config) {
  const id = safeInt(req.params.id);
  if (!id) return res.status(400).json({ success: false, error: 'INVALID_ID' });
  try {
    const existing = await dbAll(`SELECT id FROM ${config.table} WHERE id = ? LIMIT 1`, [id]);
    if (!existing.length) return res.status(404).json({ success: false, error: 'NOT_FOUND' });
    await dbRun(`UPDATE ${config.table} SET status = 'archived', updatedAt = NOW() WHERE id = ?`, [id]);
    if (config.clearNotificationsOnArchive) {
      await dbRun('DELETE FROM notifications WHERE entityType = ? AND entityId = ?', [config.entityType, id]);
    }
    broadcastDataChange('deleted', config.resource, id);
    res.json({ success: true, data: { entityType: config.entityType } });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
}

async function deletePermanentResource(req, res, config) {
  const id = safeInt(req.params.id);
  if (!id) return res.status(400).json({ success: false, error: 'INVALID_ID' });
  try {
    await withTransaction(async (tx) => {
      const existing = await tx.all(`SELECT id FROM ${config.table} WHERE id = ? LIMIT 1`, [id]);
      if (!existing.length) {
        const err = new Error('NOT_FOUND');
        err.statusCode = 404;
        throw err;
      }

      if (config.resource === 'employees') {
        await tx.run('DELETE FROM status_history WHERE entityType = ? AND entityId = ?', ['employee', id]);
        await tx.run('UPDATE vehicles SET responsibleEmployeeId = NULL WHERE responsibleEmployeeId = ?', [id]);
        await tx.run('DELETE FROM notifications WHERE entityType = ? AND entityId = ?', ['employee', id]);
      } else if (config.resource === 'branches') {
        await tx.run('DELETE FROM tax_entity_branches WHERE branchId = ?', [id]);
        await tx.run('DELETE FROM branch_custom_fields WHERE branchId = ?', [id]);
        await tx.run('DELETE FROM branch_establishments WHERE branchId = ?', [id]);
        const leases = await tx.all('SELECT id FROM branch_leases WHERE branchId = ?', [id]);
        for (const lease of leases) {
          await tx.run('DELETE FROM lease_installments WHERE leaseId = ?', [lease.id]);
        }
        await tx.run('DELETE FROM branch_leases WHERE branchId = ?', [id]);
        await tx.run('DELETE FROM branch_licenses WHERE branchId = ?', [id]);
        await tx.run('UPDATE employees SET workBranchId = NULL WHERE workBranchId = ?', [id]);
        await tx.run('DELETE FROM notifications WHERE entityType = ? AND entityId = ?', ['branch', id]);
      } else if (config.resource === 'vehicles') {
        await tx.run('DELETE FROM vehicle_custom_fields WHERE vehicleId = ?', [id]);
        await tx.run('DELETE FROM notifications WHERE entityType = ? AND entityId = ?', ['vehicle', id]);
      } else if (config.resource === 'phones') {
        await tx.run('DELETE FROM notifications WHERE entityType = ? AND entityId = ?', ['phone', id]);
      } else if (config.resource === 'housing') {
        await tx.run('DELETE FROM documents WHERE entityType = ? AND entityId = ?', ['housing', id]);
        await tx.run('UPDATE phones SET assignedHousingId = NULL WHERE assignedHousingId = ?', [id]);
        await tx.run('DELETE FROM notifications WHERE entityType = ? AND entityId = ?', ['housing', id]);
        await tx.run('DELETE FROM housing_installments WHERE housingId = ?', [id]);
        await tx.run('DELETE FROM housing_occupants WHERE housingUnitId = ?', [id]);
        await tx.run('DELETE FROM housing_custom_fields WHERE housingUnitId = ?', [id]);
      } else if (config.resource === 'entities') {
        await tx.run('DELETE FROM tax_payments WHERE entityId = ?', [id]);
        await tx.run('DELETE FROM tax_entity_branches WHERE entityId = ?', [id]);
        await tx.run('DELETE FROM notifications WHERE entityType = ? AND entityId = ?', ['entity', id]);
      } else if (config.resource === 'employers') {
        await tx.run('DELETE FROM branch_employers WHERE employerId = ?', [id]);
        await tx.run('UPDATE phones SET assignedEmployerId = NULL WHERE assignedEmployerId = ?', [id]);
        await tx.run('DELETE FROM notifications WHERE entityType = ? AND entityId = ?', ['employer', id]);
      }

      await tx.run(`DELETE FROM ${config.table} WHERE id = ?`, [id]);
    });
    broadcastDataChange('deleted', config.resource, id);
    res.json({ success: true, data: { entityType: config.entityType } });
  } catch (err) {
    const status = err && err.statusCode ? err.statusCode : 500;
    res.status(status).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
}

app.post('/api/employees/:id/archive', requireAuth, requirePermission('employees', 'archive'), (req, res) =>
  archiveResource(req, res, { table: 'employees', resource: 'employees', entityType: 'employee' })
);

app.post('/api/branches/:id/archive', requireAuth, requirePermission('branches', 'edit'), (req, res) =>
  archiveResource(req, res, { table: 'branches', resource: 'branches', entityType: 'branch', clearNotificationsOnArchive: true })
);

app.post('/api/vehicles/:id/archive', requireAuth, requirePermission('vehicles', 'edit'), (req, res) =>
  archiveResource(req, res, { table: 'vehicles', resource: 'vehicles', entityType: 'vehicle' })
);

app.post('/api/housing/:id/archive', requireAuth, requirePermission('housing', 'edit'), (req, res) =>
  archiveResource(req, res, { table: 'housing_units', resource: 'housing', entityType: 'housing' })
);

app.post('/api/phones/:id/archive', requireAuth, requirePermission('phones', 'edit'), (req, res) =>
  archiveResource(req, res, { table: 'phones', resource: 'phones', entityType: 'phone' })
);

app.post('/api/entities/:id/archive', requireAuth, requirePermission('entities', 'edit'), (req, res) =>
  archiveResource(req, res, { table: 'entities', resource: 'entities', entityType: 'entity', clearNotificationsOnArchive: true })
);

app.post('/api/employers/:id/archive', requireAuth, requirePermission('employers', 'edit'), (req, res) =>
  archiveResource(req, res, { table: 'employers', resource: 'employers', entityType: 'employer', clearNotificationsOnArchive: true })
);

app.post('/api/employees/:id/restore', requireAuth, requirePermission('employees', 'edit'), (req, res) =>
  restoreArchivedResource(req, res, { table: 'employees', resource: 'employees', entityType: 'employee' })
);

app.post('/api/branches/:id/restore', requireAuth, requirePermission('branches', 'edit'), (req, res) =>
  restoreArchivedResource(req, res, { table: 'branches', resource: 'branches', entityType: 'branch' })
);

app.post('/api/vehicles/:id/restore', requireAuth, requirePermission('vehicles', 'edit'), (req, res) =>
  restoreArchivedResource(req, res, { table: 'vehicles', resource: 'vehicles', entityType: 'vehicle' })
);

app.post('/api/housing/:id/restore', requireAuth, requirePermission('housing', 'edit'), (req, res) =>
  restoreArchivedResource(req, res, { table: 'housing_units', resource: 'housing', entityType: 'housing' })
);

app.post('/api/phones/:id/restore', requireAuth, requirePermission('phones', 'edit'), (req, res) =>
  restoreArchivedResource(req, res, { table: 'phones', resource: 'phones', entityType: 'phone' })
);

app.post('/api/entities/:id/restore', requireAuth, requirePermission('entities', 'edit'), (req, res) =>
  restoreArchivedResource(req, res, { table: 'entities', resource: 'entities', entityType: 'entity' })
);

app.post('/api/employers/:id/restore', requireAuth, requirePermission('employers', 'edit'), (req, res) =>
  restoreArchivedResource(req, res, { table: 'employers', resource: 'employers', entityType: 'employer' })
);

app.delete('/api/employees/:id/permanent', requireAuth, requirePermission('employees', 'delete'), (req, res) =>
  deletePermanentResource(req, res, { table: 'employees', resource: 'employees', entityType: 'employee' })
);

app.delete('/api/branches/:id/permanent', requireAuth, requirePermission('branches', 'delete'), (req, res) =>
  deletePermanentResource(req, res, { table: 'branches', resource: 'branches', entityType: 'branch' })
);

app.delete('/api/vehicles/:id/permanent', requireAuth, requirePermission('vehicles', 'delete'), (req, res) =>
  deletePermanentResource(req, res, { table: 'vehicles', resource: 'vehicles', entityType: 'vehicle' })
);

app.delete('/api/housing/:id/permanent', requireAuth, requirePermission('housing', 'delete'), (req, res) =>
  deletePermanentResource(req, res, { table: 'housing_units', resource: 'housing', entityType: 'housing' })
);

app.delete('/api/phones/:id/permanent', requireAuth, requirePermission('phones', 'delete'), (req, res) =>
  deletePermanentResource(req, res, { table: 'phones', resource: 'phones', entityType: 'phone' })
);

app.delete('/api/entities/:id/permanent', requireAuth, requirePermission('entities', 'delete'), (req, res) =>
  deletePermanentResource(req, res, { table: 'entities', resource: 'entities', entityType: 'entity' })
);

app.delete('/api/employers/:id/permanent', requireAuth, requirePermission('employers', 'delete'), (req, res) =>
  deletePermanentResource(req, res, { table: 'employers', resource: 'employers', entityType: 'employer' })
);

// ── Branches ─────────────────────────────────────────────────────────────────

app.get('/api/branches', requireAuth, requirePermission('branches', 'view'), async (req, res) => {
  try {
    const params = [];
    const clauses = [];
    if (req.query.isArchived !== undefined && req.query.isArchived !== '') {
      const isArchived = Number(req.query.isArchived) === 1;
      clauses.push(isArchived ? "COALESCE(status, 'active') = 'archived'" : "COALESCE(status, 'active') <> 'archived'");
    } else {
      clauses.push("COALESCE(status, 'active') <> 'archived'");
    }
    const rows = await dbAll(
      `SELECT id, code, name, nameEn, phone, country, emirate, city, address, branchType, status, photoPath, createdAt, updatedAt
       FROM branches
       ${clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''}
       ORDER BY name`,
      params
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

app.get('/api/branches/:id', requireAuth, requirePermission('branches', 'view'), async (req, res) => {
  const id = safeInt(req.params.id);
  if (!id) return res.status(400).json({ success: false, error: 'INVALID_ID' });
  try {
    const rows = await dbAll('SELECT * FROM branches WHERE id = ? LIMIT 1', [id]);
    if (!rows.length) return res.status(404).json({ success: false, error: 'NOT_FOUND' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

app.post('/api/branches', requireAuth, requirePermission('branches', 'create'), async (req, res) => {
  try {
    const { name, code, nameEn, phone, country, emirate, city, address, branchType, photoPath } = req.body || {};
    if (!name) return res.status(400).json({ success: false, error: 'NAME_REQUIRED' });
    const emirateSafe = String(emirate || 'Dubai').trim();
    if (!emirateSafe) return res.status(400).json({ success: false, error: 'EMIRATE_REQUIRED' });
    const r = await dbRun(
      `INSERT INTO branches
       (code, name, nameEn, phone, country, emirate, city, address, branchType, photoPath, status, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', NOW(), NOW())`,
      [
        code || null,
        name,
        nameEn || null,
        phone || null,
        country || 'United Arab Emirates',
        emirateSafe,
        city || null,
        address || null,
        branchType || 'store',
        photoPath || null,
      ]
    );
    broadcastDataChange('created', 'branches', r.lastID);
    res.json({ success: true, id: r.lastID });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

app.put('/api/branches/:id', requireAuth, requirePermission('branches', 'edit'), async (req, res) => {
  const id = safeInt(req.params.id);
  if (!id) return res.status(400).json({ success: false, error: 'INVALID_ID' });
  try {
    const { code, name, nameEn, phone, country, emirate, city, address, branchType, photoPath, status } = req.body || {};
    await dbRun(
      `UPDATE branches SET
         code = COALESCE(?, code),
         name = COALESCE(?, name),
         nameEn = ?,
         phone = ?,
         country = COALESCE(?, country),
         emirate = COALESCE(?, emirate),
         city = ?,
         address = ?,
         branchType = COALESCE(?, branchType),
         photoPath = ?,
         status = COALESCE(?, status),
         updatedAt = NOW()
       WHERE id = ?`,
      [
        code || null,
        name || null,
        nameEn || null,
        phone || null,
        country || null,
        emirate || null,
        city || null,
        address || null,
        branchType || null,
        photoPath || null,
        status || null,
        id,
      ]
    );
    broadcastDataChange('updated', 'branches', id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

app.delete('/api/branches/:id', requireAuth, requirePermission('branches', 'archive'), async (req, res) => {
  const id = safeInt(req.params.id);
  if (!id) return res.status(400).json({ success: false, error: 'INVALID_ID' });
  try {
    await dbRun(`UPDATE branches SET status = 'archived', updatedAt = NOW() WHERE id = ?`, [id]);
    broadcastDataChange('deleted', 'branches', id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

// ── Employees ─────────────────────────────────────────────────────────────────

app.get('/api/employees', requireAuth, requirePermission('employees', 'view'), async (req, res) => {
  try {
    let q = `SELECT e.id, e.code, e.imagePath, e.name, e.phone, e.email, e.nationality, e.passportNumber,
                    e.profession, e.contractType, e.contractStartDate, e.contractExpiryDate,
                    e.workBranchId, e.legalEntityId, e.emiratesId, e.employerName,
                    e.basicSalary, e.housingAllowance, e.transportAllowance, e.otherAllowances,
                    e.totalSalary, e.actualSalary, e.status, e.notes, e.createdAt, e.updatedAt,
                    e.emiratesId AS idNumber,
                    e.contractStartDate AS startDate,
                    e.actualSalary AS salary,
                    NULL AS housingId,
                    NULL AS vehicleId,
                    NULL AS employerId,
                    b.name as branchName
             FROM employees e LEFT JOIN branches b ON e.workBranchId = b.id`;
    const params = [];
    const conds = [];

    if (req.query.isArchived !== undefined) {
      const isArchived = Number(req.query.isArchived) === 1;
      conds.push(isArchived ? "COALESCE(e.status, 'active') = 'archived'" : "COALESCE(e.status, 'active') <> 'archived'");
    } else {
      conds.push("COALESCE(e.status, 'active') <> 'archived'");
    }
    if (req.query.branchId) {
      conds.push('e.workBranchId = ?');
      params.push(Number(req.query.branchId));
    }
    if (req.query.search) {
      conds.push('(e.name LIKE ? OR e.phone LIKE ? OR e.emiratesId LIKE ? OR e.code LIKE ?)');
      const s = `%${req.query.search}%`;
      params.push(s, s, s, s);
    }
    if (conds.length) q += ` WHERE ${conds.join(' AND ')}`;
    q += ' ORDER BY e.name';
    const rows = await dbAll(q, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

app.get('/api/employees/:id', requireAuth, requirePermission('employees', 'view'), async (req, res) => {
  const id = safeInt(req.params.id);
  if (!id) return res.status(400).json({ success: false, error: 'INVALID_ID' });
  try {
    const rows = await dbAll(
      `SELECT e.id, e.code, e.imagePath, e.name, e.phone, e.email, e.nationality, e.passportNumber,
              e.profession, e.contractType, e.contractStartDate, e.contractExpiryDate,
              e.workBranchId, e.legalEntityId, e.emiratesId, e.employerName,
              e.basicSalary, e.housingAllowance, e.transportAllowance, e.otherAllowances,
              e.totalSalary, e.actualSalary, e.status, e.notes, e.createdAt, e.updatedAt,
              e.emiratesId AS idNumber,
              e.contractStartDate AS startDate,
              e.actualSalary AS salary,
              NULL AS housingId,
              NULL AS vehicleId,
              NULL AS employerId,
              b.name as branchName
       FROM employees e LEFT JOIN branches b ON e.workBranchId = b.id WHERE e.id = ? LIMIT 1`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ success: false, error: 'NOT_FOUND' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

app.post('/api/employees', requireAuth, requirePermission('employees', 'create'), async (req, res) => {
  try {
    const d = req.body || {};
    if (!d.name) return res.status(400).json({ success: false, error: 'NAME_REQUIRED' });
    const emiratesId = d.emiratesId || d.idNumber || null;
    const contractStartDate = d.contractStartDate || d.startDate || null;
    const actualSalary = d.actualSalary ?? d.salary ?? null;
    const r = await dbRun(
      `INSERT INTO employees
       (code, imagePath, name, phone, email, nationality, passportNumber, profession,
        contractType, contractStartDate, contractExpiryDate, workBranchId, legalEntityId,
        emiratesId, employerName, basicSalary, housingAllowance, transportAllowance, otherAllowances,
        totalSalary, actualSalary, status, notes, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        d.code || null,
        d.imagePath || null,
        d.name,
        d.phone || null,
        d.email || null,
        d.nationality || null,
        d.passportNumber || null,
        d.profession || null,
        d.contractType || null,
        contractStartDate,
        d.contractExpiryDate || null,
        d.workBranchId || null,
        d.legalEntityId || null,
        emiratesId,
        d.employerName || null,
        d.basicSalary ?? null,
        d.housingAllowance ?? null,
        d.transportAllowance ?? null,
        d.otherAllowances ?? null,
        d.totalSalary ?? null,
        actualSalary,
        d.status || 'active',
        d.notes || null,
      ]
    );
    broadcastDataChange('created', 'employees', r.lastID);
    res.json({ success: true, id: r.lastID });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

app.put('/api/employees/:id', requireAuth, requirePermission('employees', 'edit'), async (req, res) => {
  const id = safeInt(req.params.id);
  if (!id) return res.status(400).json({ success: false, error: 'INVALID_ID' });
  try {
    const d = req.body || {};
    const emiratesId = d.emiratesId || d.idNumber || null;
    const contractStartDate = d.contractStartDate || d.startDate || null;
    const actualSalary = d.actualSalary ?? d.salary ?? null;
    await dbRun(
      `UPDATE employees SET
         code = COALESCE(?, code),
         imagePath = ?,
         name = COALESCE(?, name),
         phone = ?,
         email = ?,
         nationality = ?,
         passportNumber = ?,
         profession = ?,
         contractType = ?,
         contractStartDate = ?,
         contractExpiryDate = ?,
         workBranchId = ?,
         legalEntityId = ?,
         emiratesId = ?,
         employerName = ?,
         basicSalary = ?,
         housingAllowance = ?,
         transportAllowance = ?,
         otherAllowances = ?,
         totalSalary = ?,
         actualSalary = ?,
         status = COALESCE(?, status),
         notes = ?,
         updatedAt = NOW()
       WHERE id = ?`,
      [
        d.code || null,
        d.imagePath || null,
        d.name || null,
        d.phone || null,
        d.email || null,
        d.nationality || null,
        d.passportNumber || null,
        d.profession || null,
        d.contractType || null,
        contractStartDate,
        d.contractExpiryDate || null,
        d.workBranchId || null,
        d.legalEntityId || null,
        emiratesId,
        d.employerName || null,
        d.basicSalary ?? null,
        d.housingAllowance ?? null,
        d.transportAllowance ?? null,
        d.otherAllowances ?? null,
        d.totalSalary ?? null,
        actualSalary,
        d.status || null,
        d.notes || null,
        id,
      ]
    );
    broadcastDataChange('updated', 'employees', id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

app.put('/api/employees/:id/status', requireAuth, requireAnyPermission([['employees', 'action.changeStatus'], ['employees', 'edit']]), async (req, res) => {
  const id = safeInt(req.params.id);
  if (!id) return res.status(400).json({ success: false, error: 'INVALID_ID' });
  const d = req.body || {};
  const u = d.employeeUpdate || {};
  if (!u.status) return res.status(400).json({ success: false, error: 'INVALID_REQUEST' });

  const updateValues = [
    String(u.status),
    u.workBranchId ?? null,
    u.profession ?? null,
    u.professionKeys ?? null,
    u.professionCustomTitle ?? null,
    u.actualSalary ?? null,
    u.loanType ?? null,
    u.loanBranchId ?? null,
    u.loanProfession ?? null,
    u.loanSubStatus ?? null,
    u.loanExpiryDate ?? null,
    u.tempContractNumber ?? null,
    u.loanSalary ?? null,
    u.targetEntityName ?? null,
    u.loanLeaveStartDate ?? null,
    u.loanLeaveEndDate ?? null,
  ];

  try {
    await withTransaction(async (tx) => {
      const dateCorrection = d.dateCorrection || null;
      if (dateCorrection?.mainDateChanged && dateCorrection.actionDate) {
        const lastRows = await tx.all(
          "SELECT id, startDate, endDate FROM status_history WHERE entityType = 'employee' AND entityId = ? ORDER BY startDate DESC LIMIT 1",
          [id]
        );
        const last = lastRows[0];
        if (last?.id) {
          const endDate = last.endDate ? String(last.endDate).slice(0, 10) : null;
          const durationDays = endDate
            ? Math.round((new Date(endDate).getTime() - new Date(dateCorrection.actionDate).getTime()) / (1000 * 60 * 60 * 24))
            : 0;
          await tx.run(
            'UPDATE status_history SET startDate = ?, durationDays = ? WHERE id = ?',
            [String(dateCorrection.actionDate), durationDays, last.id]
          );
        }
      }

      if (d.statusChanged) {
        const effectiveDate = String(d.effectiveDate || '').slice(0, 10);
        if (!effectiveDate) throw new Error('EFFECTIVE_DATE_REQUIRED');
        const actorId = d.performedByUserId ?? req.authSession?.userId ?? null;
        const actorName = d.performedByUsername ?? null;
        const lastRows = await tx.all(
          "SELECT id, startDate FROM status_history WHERE entityType = 'employee' AND entityId = ? ORDER BY startDate DESC LIMIT 1",
          [id]
        );
        const lastRecord = lastRows[0];
        if (lastRecord?.startDate) {
          const prevStart = String(lastRecord.startDate).slice(0, 10);
          const durationDays = Math.round((new Date(effectiveDate).getTime() - new Date(prevStart).getTime()) / (1000 * 60 * 60 * 24));
          await tx.run('UPDATE status_history SET endDate = ?, durationDays = ? WHERE id = ?', [effectiveDate, durationDays, lastRecord.id]);
        } else if (d.previousStatus) {
          await tx.run(
            `INSERT INTO status_history (entityType, entityId, status, startDate, endDate, durationDays, performedByUserId, performedByUsername)
             VALUES ('employee', ?, ?, ?, ?, 0, ?, ?)`,
            [id, String(d.previousStatus), effectiveDate, effectiveDate, actorId, actorName]
          );
        }
        await tx.run(
          `INSERT INTO status_history (entityType, entityId, status, startDate, performedByUserId, performedByUsername)
           VALUES ('employee', ?, ?, ?, ?, ?)`,
          [id, String(u.status), effectiveDate, actorId, actorName]
        );
      }

      await tx.run(
        `UPDATE employees SET
           status = ?, workBranchId = ?, profession = ?, professionKeys = ?, professionCustomTitle = ?,
           actualSalary = ?, loanType = ?, loanBranchId = ?, loanProfession = ?, loanSubStatus = ?,
           loanExpiryDate = ?, tempContractNumber = ?, loanSalary = ?, targetEntityName = ?,
           loanLeaveStartDate = ?, loanLeaveEndDate = ?, updatedAt = NOW()
         WHERE id = ?`,
        [...updateValues, id]
      );
    });
    broadcastDataChange('updated', 'employees', id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

app.delete('/api/employees/:id', requireAuth, requirePermission('employees', 'archive'), async (req, res) => {
  const id = safeInt(req.params.id);
  if (!id) return res.status(400).json({ success: false, error: 'INVALID_ID' });
  try {
    await dbRun(`UPDATE employees SET status = 'archived', updatedAt = NOW() WHERE id = ?`, [id]);
    broadcastDataChange('deleted', 'employees', id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

// ── Employers ─────────────────────────────────────────────────────────────────

app.get('/api/employers', requireAuth, requirePermission('employers', 'view'), async (req, res) => {
  try {
    let q = `SELECT id, code, fullName, fullNameEn, phone, nationality, photoPath, email, emiratesId, passportNumber, status, createdAt, updatedAt,
                    emiratesId AS idNumber
             FROM employers`;
    const conds = [];
    const params = [];
    if (req.query.isArchived !== undefined) {
      const isArchived = Number(req.query.isArchived) === 1;
      conds.push(isArchived ? "COALESCE(status, 'active') = 'archived'" : "COALESCE(status, 'active') <> 'archived'");
    } else {
      conds.push("COALESCE(status, 'active') <> 'archived'");
    }
    if (req.query.search) {
      conds.push('(fullName LIKE ? OR phone LIKE ? OR code LIKE ?)');
      const s = `%${req.query.search}%`;
      params.push(s, s, s);
    }
    if (conds.length) q += ` WHERE ${conds.join(' AND ')}`;
    q += ' ORDER BY fullName';
    const rows = await dbAll(q, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

app.get('/api/employers/:id', requireAuth, requirePermission('employers', 'view'), async (req, res) => {
  const id = safeInt(req.params.id);
  if (!id) return res.status(400).json({ success: false, error: 'INVALID_ID' });
  try {
    const rows = await dbAll(
      `SELECT id, code, fullName, fullNameEn, phone, nationality, photoPath, email, emiratesId, passportNumber, status, createdAt, updatedAt,
              emiratesId AS idNumber
       FROM employers WHERE id = ? LIMIT 1`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ success: false, error: 'NOT_FOUND' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

app.post('/api/employers', requireAuth, requirePermission('employers', 'create'), async (req, res) => {
  try {
    const d = req.body || {};
    if (!d.fullName) return res.status(400).json({ success: false, error: 'FULL_NAME_REQUIRED' });
    const emiratesId = d.emiratesId || d.idNumber || null;
    const r = await dbRun(
      `INSERT INTO employers
       (code, fullName, fullNameEn, nationality, phone, email, passportNumber, emiratesId, photoPath, status, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', NOW(), NOW())`,
      [
        d.code || null,
        d.fullName,
        d.fullNameEn || null,
        d.nationality || null,
        d.phone || null,
        d.email || null,
        d.passportNumber || null,
        emiratesId,
        d.photoPath || null,
      ]
    );
    broadcastDataChange('created', 'employers', r.lastID);
    res.json({ success: true, id: r.lastID });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

app.put('/api/employers/:id', requireAuth, requirePermission('employers', 'edit'), async (req, res) => {
  const id = safeInt(req.params.id);
  if (!id) return res.status(400).json({ success: false, error: 'INVALID_ID' });
  try {
    const d = req.body || {};
    const emiratesId = d.emiratesId || d.idNumber || null;
    await dbRun(
      `UPDATE employers SET
         code = COALESCE(?, code),
         fullName = COALESCE(?, fullName),
         fullNameEn = ?,
         phone = ?,
         nationality = ?,
         email = ?,
         passportNumber = ?,
         emiratesId = ?,
         photoPath = ?,
         status = COALESCE(?, status),
         updatedAt = NOW()
       WHERE id = ?`,
      [
        d.code || null,
        d.fullName || null,
        d.fullNameEn || null,
        d.phone || null,
        d.nationality || null,
        d.email || null,
        d.passportNumber || null,
        emiratesId,
        d.photoPath || null,
        d.status || null,
        id,
      ]
    );
    broadcastDataChange('updated', 'employers', id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

app.delete('/api/employers/:id', requireAuth, requirePermission('employers', 'archive'), async (req, res) => {
  const id = safeInt(req.params.id);
  if (!id) return res.status(400).json({ success: false, error: 'INVALID_ID' });
  try {
    await dbRun(`UPDATE employers SET status = 'archived', updatedAt = NOW() WHERE id = ?`, [id]);
    broadcastDataChange('deleted', 'employers', id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

// ── Housing ───────────────────────────────────────────────────────────────────

app.get('/api/housing', requireAuth, requirePermission('housing', 'view'), async (req, res) => {
  try {
    let q = `SELECT h.id, h.code, h.name, h.address, h.branchId, h.rentAmount AS rent, h.status, h.createdAt, h.updatedAt, b.name as branchName
             FROM housing_units h LEFT JOIN branches b ON h.branchId = b.id`;
    const conds = [];
    const params = [];
    if (req.query.isArchived !== undefined) {
      const isArchived = Number(req.query.isArchived) === 1;
      conds.push(isArchived ? "COALESCE(h.status,'active') = 'archived'" : "COALESCE(h.status,'active') <> 'archived'");
    } else {
      conds.push("COALESCE(h.status,'active') <> 'archived'");
    }
    if (req.query.branchId) {
      conds.push('h.branchId = ?');
      params.push(Number(req.query.branchId));
    }
    if (conds.length) q += ` WHERE ${conds.join(' AND ')}`;
    q += ' ORDER BY h.name';
    const rows = await dbAll(q, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

app.get('/api/housing/:id', requireAuth, requirePermission('housing', 'view'), async (req, res) => {
  const id = safeInt(req.params.id);
  if (!id) return res.status(400).json({ success: false, error: 'INVALID_ID' });
  try {
    const rows = await dbAll(
      `SELECT h.id, h.code, h.name, h.address, h.branchId, h.rentAmount AS rent, h.status, h.createdAt, h.updatedAt, b.name as branchName
       FROM housing_units h LEFT JOIN branches b ON h.branchId = b.id WHERE h.id = ? LIMIT 1`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ success: false, error: 'NOT_FOUND' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

app.post('/api/housing', requireAuth, requirePermission('housing', 'create'), async (req, res) => {
  try {
    const d = req.body || {};
    if (!d.name) return res.status(400).json({ success: false, error: 'NAME_REQUIRED' });
    const r = await dbRun(
      `INSERT INTO housing_units (name, address, branchId, rentAmount, status, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, 'active', NOW(), NOW())`,
      [d.name, d.address || null, d.branchId || null, d.rent || null]
    );
    broadcastDataChange('created', 'housing', r.lastID);
    res.json({ success: true, id: r.lastID });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

app.put('/api/housing/:id', requireAuth, requirePermission('housing', 'edit'), async (req, res) => {
  const id = safeInt(req.params.id);
  if (!id) return res.status(400).json({ success: false, error: 'INVALID_ID' });
  try {
    const d = req.body || {};
    await dbRun(
      `UPDATE housing_units SET name = COALESCE(?, name), address = ?, branchId = ?, rentAmount = ?, updatedAt = NOW() WHERE id = ?`,
      [d.name || null, d.address || null, d.branchId || null, d.rent || null, id]
    );
    broadcastDataChange('updated', 'housing', id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

app.delete('/api/housing/:id', requireAuth, requirePermission('housing', 'archive'), async (req, res) => {
  const id = safeInt(req.params.id);
  if (!id) return res.status(400).json({ success: false, error: 'INVALID_ID' });
  try {
    await dbRun(`UPDATE housing_units SET status = 'archived', updatedAt = NOW() WHERE id = ?`, [id]);
    broadcastDataChange('deleted', 'housing', id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

// ── Vehicles ──────────────────────────────────────────────────────────────────

app.get('/api/vehicles', requireAuth, requirePermission('vehicles', 'view'), async (req, res) => {
  try {
    let q = `SELECT v.id, v.code, v.plateNumber, v.plateCode, v.vehicleName, v.brand, v.model, v.year,
                    v.vehicleType, v.ownershipType, v.ownerName, v.issuePlace, v.trafficNo, v.chassisNo, v.engineNo,
                    v.licenseRegDate, v.licenseExpiryDate, v.insuranceCompany, v.insuranceExpiryDate, v.insuranceType, v.insurancePolicyNo,
                    v.branchId, v.photoPath, v.status, v.createdAt, v.updatedAt,
                    v.vehicleType AS color,
                    b.name as branchName
             FROM vehicles v LEFT JOIN branches b ON v.branchId = b.id`;
    const conds = [];
    const params = [];
    if (req.query.isArchived !== undefined) {
      const isArchived = Number(req.query.isArchived) === 1;
      conds.push(isArchived ? "COALESCE(v.status, 'active') = 'archived'" : "COALESCE(v.status, 'active') <> 'archived'");
    } else {
      conds.push("COALESCE(v.status, 'active') <> 'archived'");
    }
    if (req.query.branchId) {
      conds.push('v.branchId = ?');
      params.push(Number(req.query.branchId));
    }
    if (req.query.search) {
      conds.push('(v.plateNumber LIKE ? OR v.model LIKE ? OR v.vehicleName LIKE ? OR v.code LIKE ?)');
      const s = `%${req.query.search}%`;
      params.push(s, s, s, s);
    }
    if (conds.length) q += ` WHERE ${conds.join(' AND ')}`;
    q += ' ORDER BY v.plateNumber';
    const rows = await dbAll(q, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

app.get('/api/vehicles/:id', requireAuth, requirePermission('vehicles', 'view'), async (req, res) => {
  const id = safeInt(req.params.id);
  if (!id) return res.status(400).json({ success: false, error: 'INVALID_ID' });
  try {
    const rows = await dbAll(
      `SELECT v.id, v.code, v.plateNumber, v.plateCode, v.vehicleName, v.brand, v.model, v.year,
              v.vehicleType, v.ownershipType, v.ownerName, v.issuePlace, v.trafficNo, v.chassisNo, v.engineNo,
              v.licenseRegDate, v.licenseExpiryDate, v.insuranceCompany, v.insuranceExpiryDate, v.insuranceType, v.insurancePolicyNo,
              v.branchId, v.photoPath, v.status, v.createdAt, v.updatedAt,
              v.vehicleType AS color,
              b.name as branchName
       FROM vehicles v LEFT JOIN branches b ON v.branchId = b.id WHERE v.id = ? LIMIT 1`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ success: false, error: 'NOT_FOUND' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

app.post('/api/vehicles', requireAuth, requirePermission('vehicles', 'create'), async (req, res) => {
  try {
    const d = req.body || {};
    if (!d.plateNumber) return res.status(400).json({ success: false, error: 'PLATE_REQUIRED' });
    const vehicleType = d.vehicleType || d.color || null;
    const r = await dbRun(
      `INSERT INTO vehicles
       (code, photoPath, plateNumber, plateCode, vehicleName, brand, model, year, vehicleType, ownershipType, ownerName, issuePlace,
        trafficNo, chassisNo, engineNo, licenseRegDate, licenseExpiryDate, insuranceCompany, insuranceExpiryDate, insuranceType, insurancePolicyNo,
        branchId, responsibleEmployeeId, responsibleEmployerId, responsibleName, status, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', NOW(), NOW())`,
      [
        d.code || null,
        d.photoPath || null,
        d.plateNumber,
        d.plateCode || null,
        d.vehicleName || null,
        d.brand || null,
        d.model || null,
        d.year || null,
        vehicleType,
        d.ownershipType || null,
        d.ownerName || null,
        d.issuePlace || null,
        d.trafficNo || null,
        d.chassisNo || null,
        d.engineNo || null,
        d.licenseRegDate || null,
        d.licenseExpiryDate || null,
        d.insuranceCompany || null,
        d.insuranceExpiryDate || null,
        d.insuranceType || null,
        d.insurancePolicyNo || null,
        d.branchId || null,
        d.responsibleEmployeeId || null,
        d.responsibleEmployerId || null,
        d.responsibleName || null,
      ]
    );
    broadcastDataChange('created', 'vehicles', r.lastID);
    res.json({ success: true, id: r.lastID });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

app.put('/api/vehicles/:id', requireAuth, requirePermission('vehicles', 'edit'), async (req, res) => {
  const id = safeInt(req.params.id);
  if (!id) return res.status(400).json({ success: false, error: 'INVALID_ID' });
  try {
    const d = req.body || {};
    const vehicleType = d.vehicleType || d.color || null;
    await dbRun(
      `UPDATE vehicles SET
         code = COALESCE(?, code),
         photoPath = ?,
         plateNumber = COALESCE(?, plateNumber),
         plateCode = ?,
         vehicleName = ?,
         brand = ?,
         model = ?,
         year = ?,
         vehicleType = ?,
         ownershipType = ?,
         ownerName = ?,
         issuePlace = ?,
         trafficNo = ?,
         chassisNo = ?,
         engineNo = ?,
         licenseRegDate = ?,
         licenseExpiryDate = ?,
         insuranceCompany = ?,
         insuranceExpiryDate = ?,
         insuranceType = ?,
         insurancePolicyNo = ?,
         branchId = ?,
         responsibleEmployeeId = ?,
         responsibleEmployerId = ?,
         responsibleName = ?,
         status = COALESCE(?, status),
         updatedAt = NOW()
       WHERE id = ?`,
      [
        d.code || null,
        d.photoPath || null,
        d.plateNumber || null,
        d.plateCode || null,
        d.vehicleName || null,
        d.brand || null,
        d.model || null,
        d.year || null,
        vehicleType,
        d.ownershipType || null,
        d.ownerName || null,
        d.issuePlace || null,
        d.trafficNo || null,
        d.chassisNo || null,
        d.engineNo || null,
        d.licenseRegDate || null,
        d.licenseExpiryDate || null,
        d.insuranceCompany || null,
        d.insuranceExpiryDate || null,
        d.insuranceType || null,
        d.insurancePolicyNo || null,
        d.branchId || null,
        d.responsibleEmployeeId || null,
        d.responsibleEmployerId || null,
        d.responsibleName || null,
        d.status || null,
        id,
      ]
    );
    broadcastDataChange('updated', 'vehicles', id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

app.delete('/api/vehicles/:id', requireAuth, requirePermission('vehicles', 'archive'), async (req, res) => {
  const id = safeInt(req.params.id);
  if (!id) return res.status(400).json({ success: false, error: 'INVALID_ID' });
  try {
    await dbRun(`UPDATE vehicles SET status = 'archived', updatedAt = NOW() WHERE id = ?`, [id]);
    broadcastDataChange('deleted', 'vehicles', id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

// ── Phones ────────────────────────────────────────────────────────────────────

app.get('/api/phones', requireAuth, requirePermission('phones', 'view'), async (req, res) => {
  try {
    let q = `SELECT p.id, p.code, p.phoneNumber, p.provider, p.category, p.numberType, p.billAmount,
                    p.legalEntityId, p.registeredName, p.assignedBranchId, p.assignedEmployeeId, p.assignedHousingId, p.assignedEmployerId,
                    p.status, p.note, p.createdAt, p.updatedAt,
                    p.phoneNumber AS phone,
                    p.assignedBranchId AS branchId,
                    p.assignedEmployeeId AS employeeId,
                    p.assignedHousingId AS housingId,
                    p.assignedEmployerId AS employerId,
                    b.name AS branchName
             FROM phones p
             LEFT JOIN branches b ON b.id = p.assignedBranchId`;
    const conds = [];
    const params = [];
    if (req.query.isArchived !== undefined) {
      const isArchived = Number(req.query.isArchived) === 1;
      conds.push(isArchived ? "COALESCE(p.status, 'active') = 'archived'" : "COALESCE(p.status, 'active') <> 'archived'");
    } else {
      conds.push("COALESCE(p.status, 'active') <> 'archived'");
    }
    if (req.query.branchId) {
      conds.push('p.assignedBranchId = ?');
      params.push(Number(req.query.branchId));
    }
    if (req.query.search) {
      conds.push('(p.phoneNumber LIKE ? OR p.code LIKE ? OR p.registeredName LIKE ?)');
      const s = `%${req.query.search}%`;
      params.push(s, s, s);
    }
    if (conds.length) q += ` WHERE ${conds.join(' AND ')}`;
    q += ' ORDER BY p.phoneNumber';
    const rows = await dbAll(q, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

app.get('/api/phones/:id', requireAuth, requirePermission('phones', 'view'), async (req, res) => {
  const id = safeInt(req.params.id);
  if (!id) return res.status(400).json({ success: false, error: 'INVALID_ID' });
  try {
    const rows = await dbAll(
      `SELECT p.id, p.code, p.phoneNumber, p.provider, p.category, p.numberType, p.billAmount,
              p.legalEntityId, p.registeredName, p.assignedBranchId, p.assignedEmployeeId, p.assignedHousingId, p.assignedEmployerId,
              p.status, p.note, p.createdAt, p.updatedAt,
              p.phoneNumber AS phone,
              p.assignedBranchId AS branchId,
              p.assignedEmployeeId AS employeeId,
              p.assignedHousingId AS housingId,
              p.assignedEmployerId AS employerId,
              b.name AS branchName
       FROM phones p
       LEFT JOIN branches b ON b.id = p.assignedBranchId
       WHERE p.id = ? LIMIT 1`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ success: false, error: 'NOT_FOUND' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

app.post('/api/phones', requireAuth, requirePermission('phones', 'create'), async (req, res) => {
  try {
    const d = req.body || {};
    const phoneNumber = d.phoneNumber || d.phone || null;
    if (!phoneNumber) return res.status(400).json({ success: false, error: 'PHONE_REQUIRED' });
    const r = await dbRun(
      `INSERT INTO phones
       (code, phoneNumber, provider, category, numberType, billAmount, legalEntityId, registeredName,
        assignedBranchId, assignedEmployeeId, assignedHousingId, assignedEmployerId, status, note, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        d.code || null,
        phoneNumber,
        d.provider || 'etisalat',
        d.category || 'postpaid',
        d.numberType || 'mobile',
        d.billAmount ?? null,
        d.legalEntityId || null,
        d.registeredName || null,
        d.assignedBranchId || d.branchId || null,
        d.assignedEmployeeId || d.employeeId || null,
        d.assignedHousingId || d.housingId || null,
        d.assignedEmployerId || d.employerId || null,
        d.status || 'active',
        d.note || null,
      ]
    );
    broadcastDataChange('created', 'phones', r.lastID);
    res.json({ success: true, id: r.lastID });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

app.put('/api/phones/:id', requireAuth, requirePermission('phones', 'edit'), async (req, res) => {
  const id = safeInt(req.params.id);
  if (!id) return res.status(400).json({ success: false, error: 'INVALID_ID' });
  try {
    const d = req.body || {};
    const phoneNumber = d.phoneNumber || d.phone || null;
    await dbRun(
      `UPDATE phones SET
         code = COALESCE(?, code),
         phoneNumber = COALESCE(?, phoneNumber),
         provider = COALESCE(?, provider),
         category = COALESCE(?, category),
         numberType = COALESCE(?, numberType),
         billAmount = ?,
         legalEntityId = ?,
         registeredName = ?,
         assignedBranchId = ?,
         assignedEmployeeId = ?,
         assignedHousingId = ?,
         assignedEmployerId = ?,
         status = COALESCE(?, status),
         note = ?,
         updatedAt = NOW()
       WHERE id = ?`,
      [
        d.code || null,
        phoneNumber,
        d.provider || null,
        d.category || null,
        d.numberType || null,
        d.billAmount ?? null,
        d.legalEntityId || null,
        d.registeredName || null,
        d.assignedBranchId || d.branchId || null,
        d.assignedEmployeeId || d.employeeId || null,
        d.assignedHousingId || d.housingId || null,
        d.assignedEmployerId || d.employerId || null,
        d.status || null,
        d.note || null,
        id,
      ]
    );
    broadcastDataChange('updated', 'phones', id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

app.delete('/api/phones/:id', requireAuth, requirePermission('phones', 'archive'), async (req, res) => {
  const id = safeInt(req.params.id);
  if (!id) return res.status(400).json({ success: false, error: 'INVALID_ID' });
  try {
    await dbRun(`UPDATE phones SET status = 'archived', updatedAt = NOW() WHERE id = ?`, [id]);
    broadcastDataChange('deleted', 'phones', id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

// ── Settings ──────────────────────────────────────────────────────────────────

app.get('/api/settings', requireAuth, requirePermission('settings', 'view'), async (_req, res) => {
  try {
    const rows = await dbAll(`SELECT id, \`key\`, \`value\`, updatedAt FROM settings ORDER BY \`key\``);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

app.get('/api/settings/:key', requireAuth, requirePermission('settings', 'view'), async (req, res) => {
  try {
    const rows = await dbAll(`SELECT id, \`key\`, \`value\`, updatedAt FROM settings WHERE \`key\` = ? LIMIT 1`, [req.params.key]);
    if (!rows.length) return res.status(404).json({ success: false, error: 'NOT_FOUND' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

app.post('/api/settings', requireAuth, requirePermission('settings', 'edit'), async (req, res) => {
  try {
    const d = req.body || {};
    const key = String(d.key || '').trim();
    if (!key) return res.status(400).json({ success: false, error: 'KEY_REQUIRED' });
    const value = d.value == null ? null : String(d.value);
    await dbRun(
      `INSERT INTO settings (\`key\`, \`value\`)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE \`value\` = VALUES(\`value\`), updatedAt = NOW()`,
      [key, value]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

app.delete('/api/settings/:key', requireAuth, requirePermission('settings', 'delete'), async (req, res) => {
  try {
    await dbRun(`DELETE FROM settings WHERE \`key\` = ?`, [req.params.key]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

// ── Tax (payments + entity-branches) ─────────────────────────────────────────

const requireTaxView = requireAnyPermission([['settings', 'view'], ['entities', 'view']]);
const requireTaxEdit = requireAnyPermission([['settings', 'edit'], ['entities', 'edit']]);

app.get('/api/tax/payments', requireAuth, requireTaxView, async (req, res) => {
  try {
    let q = `SELECT id, entityId, type, financialYear, quarter, periodFrom, periodTo, amount, paymentDate
             FROM tax_payments`;
    const conds = [];
    const params = [];
    if (req.query.entityId) {
      conds.push('entityId = ?');
      params.push(Number(req.query.entityId));
    }
    if (req.query.type) {
      conds.push('type = ?');
      params.push(String(req.query.type));
    }
    if (req.query.financialYear) {
      conds.push('financialYear = ?');
      params.push(Number(req.query.financialYear));
    }
    if (conds.length) q += ` WHERE ${conds.join(' AND ')}`;
    q += ' ORDER BY id DESC';
    const rows = await dbAll(q, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

app.get('/api/tax/payments/:id', requireAuth, requireTaxView, async (req, res) => {
  const id = safeInt(req.params.id);
  if (!id) return res.status(400).json({ success: false, error: 'INVALID_ID' });
  try {
    const rows = await dbAll(
      `SELECT id, entityId, type, financialYear, quarter, periodFrom, periodTo, amount, paymentDate
       FROM tax_payments WHERE id = ? LIMIT 1`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ success: false, error: 'NOT_FOUND' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

app.post('/api/tax/payments', requireAuth, requireTaxEdit, async (req, res) => {
  try {
    const d = req.body || {};
    if (!d.entityId || !d.type || !d.financialYear || d.amount == null || !d.paymentDate) {
      return res.status(400).json({ success: false, error: 'INVALID_REQUEST' });
    }
    const r = await dbRun(
      `INSERT INTO tax_payments (entityId, type, financialYear, quarter, periodFrom, periodTo, amount, paymentDate)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        Number(d.entityId),
        String(d.type),
        Number(d.financialYear),
        d.quarter == null ? null : Number(d.quarter),
        d.periodFrom || null,
        d.periodTo || null,
        d.amount,
        String(d.paymentDate),
      ]
    );
    res.json({ success: true, id: r.lastID });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

app.put('/api/tax/payments/:id', requireAuth, requireTaxEdit, async (req, res) => {
  const id = safeInt(req.params.id);
  if (!id) return res.status(400).json({ success: false, error: 'INVALID_ID' });
  try {
    const d = req.body || {};
    await dbRun(
      `UPDATE tax_payments SET
         entityId = COALESCE(?, entityId),
         type = COALESCE(?, type),
         financialYear = COALESCE(?, financialYear),
         quarter = ?,
         periodFrom = ?,
         periodTo = ?,
         amount = COALESCE(?, amount),
         paymentDate = COALESCE(?, paymentDate)
       WHERE id = ?`,
      [
        d.entityId == null ? null : Number(d.entityId),
        d.type == null ? null : String(d.type),
        d.financialYear == null ? null : Number(d.financialYear),
        d.quarter == null ? null : Number(d.quarter),
        d.periodFrom || null,
        d.periodTo || null,
        d.amount ?? null,
        d.paymentDate == null ? null : String(d.paymentDate),
        id,
      ]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

app.delete('/api/tax/payments/:id', requireAuth, requireTaxEdit, async (req, res) => {
  const id = safeInt(req.params.id);
  if (!id) return res.status(400).json({ success: false, error: 'INVALID_ID' });
  try {
    await dbRun(`DELETE FROM tax_payments WHERE id = ?`, [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

app.get('/api/tax/entity-branches', requireAuth, requireTaxView, async (req, res) => {
  const entityId = req.query.entityId ? Number(req.query.entityId) : 0;
  if (!entityId) return res.status(400).json({ success: false, error: 'ENTITY_ID_REQUIRED' });
  try {
    const rows = await dbAll(
      `SELECT teb.entityId, teb.branchId, b.name AS branchName
       FROM tax_entity_branches teb
       LEFT JOIN branches b ON b.id = teb.branchId
       WHERE teb.entityId = ?
       ORDER BY teb.branchId`,
      [entityId]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

app.post('/api/tax/entity-branches', requireAuth, requireTaxEdit, async (req, res) => {
  try {
    const d = req.body || {};
    if (!d.entityId || !d.branchId) return res.status(400).json({ success: false, error: 'INVALID_REQUEST' });
    await dbRun(
      `INSERT INTO tax_entity_branches (entityId, branchId) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE entityId = entityId`,
      [Number(d.entityId), Number(d.branchId)]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

app.put('/api/tax/entity-branches/:entityId', requireAuth, requireTaxEdit, async (req, res) => {
  const entityId = safeInt(req.params.entityId);
  if (!entityId) return res.status(400).json({ success: false, error: 'INVALID_ID' });
  try {
    const rawBranchIds = Array.isArray(req.body?.branchIds) ? req.body.branchIds : [];
    const branchIds = [...new Set(rawBranchIds
      .map((x) => Number(x))
      .filter((x) => Number.isInteger(x) && x > 0))];

    await withTransaction(async (tx) => {
      await tx.run('DELETE FROM tax_entity_branches WHERE entityId = ?', [entityId]);
      for (const branchId of branchIds) {
        await tx.run(
          `INSERT INTO tax_entity_branches (entityId, branchId) VALUES (?, ?)
           ON DUPLICATE KEY UPDATE entityId = entityId`,
          [entityId, branchId]
        );
      }
    });
    res.json({ success: true, data: { entityId, branchIds } });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

app.delete('/api/tax/entity-branches', requireAuth, requireTaxEdit, async (req, res) => {
  try {
    const d = req.body || {};
    if (!d.entityId || !d.branchId) return res.status(400).json({ success: false, error: 'INVALID_REQUEST' });
    await dbRun(`DELETE FROM tax_entity_branches WHERE entityId = ? AND branchId = ?`, [Number(d.entityId), Number(d.branchId)]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

// ── Users (read-only list + create/update via Admin) ──────────────────────────

app.get('/api/users', requireAuth, requirePermission('users', 'view'), async (req, res) => {
  try {
    const rows = await dbAll(
      `SELECT u.id, u.username, u.fullName, u.email, u.roleId, u.isActive, u.mustChangePassword,
              u.userType, u.linkedEntityType, u.linkedEntityId, u.createdAt, u.updatedAt,
              r.name as roleName
       FROM users u LEFT JOIN roles r ON u.roleId = r.id
       WHERE u.username != 'alkhatib_dev'
       ORDER BY u.username`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

app.get('/api/users/:id/permissions', requireAuth, requirePermission('settings', 'sub.permissions'), async (req, res) => {
  const id = safeInt(req.params.id);
  if (!id) return res.status(400).json({ success: false, error: 'INVALID_ID' });
  try {
    const rows = await dbAll(
      `SELECT up.permissionId
       FROM user_permissions up
       INNER JOIN users u ON u.id = up.userId
       WHERE up.userId = ?
       ORDER BY up.permissionId`,
      [id]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

app.put('/api/users/:id/permissions', requireAuth, requirePermission('settings', 'edit'), async (req, res) => {
  const id = safeInt(req.params.id);
  if (!id) return res.status(400).json({ success: false, error: 'INVALID_ID' });
  const rawIds = Array.isArray(req.body?.permissionIds) ? req.body.permissionIds : [];
  const permissionIds = [...new Set(rawIds.map((x) => Number(x)).filter((x) => Number.isInteger(x) && x > 0))];

  try {
    const targetRows = await dbAll('SELECT id, roleId FROM users WHERE id = ? LIMIT 1', [id]);
    if (!targetRows.length) return res.status(404).json({ success: false, error: 'NOT_FOUND' });
    if (Number(targetRows[0].roleId) === 1) return res.status(400).json({ success: false, error: 'ADMIN_IMMUTABLE' });

    let validIds = [];
    if (permissionIds.length > 0) {
      const placeholders = permissionIds.map(() => '?').join(',');
      const rows = await dbAll(`SELECT id FROM permissions WHERE id IN (${placeholders})`, permissionIds);
      validIds = rows.map((r) => Number(r.id)).filter((x) => Number.isInteger(x) && x > 0);
    }

    await withTransaction(async (tx) => {
      await tx.run('DELETE FROM user_permissions WHERE userId = ?', [id]);
      for (const permissionId of validIds) {
        await tx.run('INSERT IGNORE INTO user_permissions (userId, permissionId) VALUES (?, ?)', [id, permissionId]);
      }
      await tx.run('UPDATE users SET permissionVersion = permissionVersion + 1, updatedAt = NOW() WHERE id = ?', [id]);
    });
    clearAllPermissionCache();

    try {
      await dbRun('INSERT INTO permission_audit_logs (actorUserId, action, details) VALUES (?, ?, ?)', [
        req.authSession.userId,
        'USER_PERMISSIONS_REPLACE',
        JSON.stringify({ userId: id, permissionCount: validIds.length }),
      ]);
    } catch {
      /* optional audit table */
    }

    broadcastDataChange('updated', 'user_permissions', id);
    res.json({ success: true, data: { permissionIds: validIds } });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

app.get('/api/users/:id', requireAuth, requirePermission('users', 'view'), async (req, res) => {
  const id = safeInt(req.params.id);
  if (!id) return res.status(400).json({ success: false, error: 'INVALID_ID' });
  try {
    const rows = await dbAll(
      `SELECT u.id, u.username, u.fullName, u.email, u.roleId, u.isActive, u.mustChangePassword,
              u.userType, u.linkedEntityType, u.linkedEntityId, r.name as roleName
       FROM users u LEFT JOIN roles r ON u.roleId = r.id WHERE u.id = ? LIMIT 1`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ success: false, error: 'NOT_FOUND' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

// ── Stats / Dashboard summary ─────────────────────────────────────────────────

app.get('/api/stats/summary', requireAuth, requirePermission('logs', 'view'), async (req, res) => {
  try {
    const [branches, employees, employers, housing, vehicles] = await Promise.all([
      dbAll("SELECT COUNT(*) as count FROM branches WHERE COALESCE(status, 'active') <> 'archived'"),
      dbAll("SELECT COUNT(*) as count FROM employees WHERE COALESCE(status, 'active') <> 'archived'"),
      dbAll("SELECT COUNT(*) as count FROM employers WHERE COALESCE(status, 'active') <> 'archived'"),
      dbAll("SELECT COUNT(*) as count FROM housing_units WHERE COALESCE(status, 'active') <> 'archived'"),
      dbAll("SELECT COUNT(*) as count FROM vehicles WHERE COALESCE(status, 'active') <> 'archived'"),
    ]);
    res.json({
      success: true,
      data: {
        branches: branches[0]?.count ?? 0,
        employees: employees[0]?.count ?? 0,
        employers: employers[0]?.count ?? 0,
        housing: housing[0]?.count ?? 0,
        vehicles: vehicles[0]?.count ?? 0,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// WebSocket server — real-time notifications (Phase 3)
//
// Protocol (JSON messages):
//   Client → Server:
//     { type: "auth",       token: "<session token>" }
//     { type: "subscribe",  channel: "attendance" | "messages" | "data" }
//     { type: "unsubscribe",channel: "..." }
//     { type: "ping" }
//
//   Server → Client:
//     { type: "auth_ok",    userId: <number> }
//     { type: "auth_fail",  error: "UNAUTHORIZED" }
//     { type: "subscribed", channel: "..." }
//     { type: "pong" }
//     { type: "event",      channel: "...", event: "...", payload: {...} }
//       - channel:"data"       event:"created"|"updated"|"deleted"  payload:{resource,id,...}
//       - channel:"attendance" event:"clock_in"|"clock_out"         payload:{employeeId,time,...}
//       - channel:"messages"   event:"new_message"                  payload:{from,text,time}
//
// Usage — broadcasting from a REST route:
//   wsBroadcast('data',       { event: 'updated', resource: 'employees', id: 5 });
//   wsBroadcast('attendance', { event: 'clock_in', employeeId: 12, time: new Date() });
// ═══════════════════════════════════════════════════════════════════════════════

const http = require('http');
const { WebSocketServer } = require('ws');

/** @type {Map<import('ws').WebSocket, { userId: number | null, channels: Set<string> }>} */
const wsClients = new Map();

/**
 * Broadcast a message to all authenticated clients subscribed to a channel.
 * @param {string} channel
 * @param {object} payload  — will be merged with { type:'event', channel }
 */
function wsBroadcast(channel, payload) {
  const msg = JSON.stringify({ type: 'event', channel, ...payload });
  for (const [client, meta] of wsClients.entries()) {
    if (meta.userId && meta.channels.has(channel) && client.readyState === 1 /* OPEN */) {
      client.send(msg);
    }
  }
}

// Expose broadcaster so REST routes added later can call it
app.locals.wsBroadcast = wsBroadcast;

const httpServer = http.createServer(app);

const wss = new WebSocketServer({ server: httpServer });

wss.on('connection', (ws) => {
  wsClients.set(ws, { userId: null, channels: new Set() });

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(String(raw)); } catch { return; }

    const meta = wsClients.get(ws);
    if (!meta) return;

    if (msg.type === 'ping') {
      ws.send(JSON.stringify({ type: 'pong' }));
      return;
    }

    if (msg.type === 'auth') {
      const token = String(msg.token || '');
      let userId = null;
      if (JWT_SECRET) {
        try {
          const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
          const uid = Number(decoded?.sub || 0);
          if (uid > 0) userId = uid;
        } catch {
          userId = null;
        }
      }
      if (!userId) {
        const session = sessions.get(token);
        if (session && session.exp >= Date.now()) userId = session.userId;
      }
      if (!userId) {
        ws.send(JSON.stringify({ type: 'auth_fail', error: 'UNAUTHORIZED' }));
        return;
      }
      meta.userId = userId;
      ws.send(JSON.stringify({ type: 'auth_ok', userId }));
      return;
    }

    // All other message types require authentication
    if (!meta.userId) {
      ws.send(JSON.stringify({ type: 'auth_fail', error: 'UNAUTHORIZED' }));
      return;
    }

    if (msg.type === 'subscribe') {
      const ch = String(msg.channel || '');
      const valid = ['attendance', 'messages', 'data'];
      if (!valid.includes(ch)) {
        ws.send(JSON.stringify({ type: 'error', error: 'UNKNOWN_CHANNEL' }));
        return;
      }
      meta.channels.add(ch);
      ws.send(JSON.stringify({ type: 'subscribed', channel: ch }));
      return;
    }

    if (msg.type === 'unsubscribe') {
      meta.channels.delete(String(msg.channel || ''));
      return;
    }
  });

  ws.on('close', () => wsClients.delete(ws));
  ws.on('error', () => wsClients.delete(ws));
});

// Heartbeat — drop dead connections every 30 s
setInterval(() => {
  for (const [ws, meta] of wsClients.entries()) {
    if (ws.readyState !== 1 /* OPEN */) {
      wsClients.delete(ws);
      continue;
    }
    // Refresh session expiry check
    if (meta.userId) {
      // Session is stored by token; we keep userId in wsClients which is fine
    }
  }
}, 30_000);

app.use((err, _req, res, next) => {
  if (!err) return next();
  if (err?.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ success: false, error: 'FILE_TOO_LARGE' });
  }
  return res.status(500).json({ success: false, error: 'SERVER_ERROR' });
});

const PORT = process.env.API_PORT || 3001;
const WS_PORT = process.env.WS_PORT ? Number(process.env.WS_PORT) : null;

if (WS_PORT) {
  // Separate WS port (optional, for environments that split HTTP/WS)
  const wsOnly = http.createServer();
  const wssOnly = new WebSocketServer({ server: wsOnly });
  wssOnly.on('connection', (ws) => wss.emit('connection', ws));
  wsOnly.listen(WS_PORT, '0.0.0.0', () => {
    console.log(`WebSocket server also on port ${WS_PORT}`);
  });
}

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`API + WebSocket server listening on 0.0.0.0:${PORT}`);
  console.log(`  REST : http://0.0.0.0:${PORT}/api/...`);
  console.log(`  WS   : ws://0.0.0.0:${PORT}  (upgrade on same port)`);
  console.log(`  Storage root: ${storageRoot}`);
  seedPermissionCatalog(dbRun)
    .then(() => console.log('  Permission catalog seed: OK'))
    .catch((e) => console.error('Permission catalog seed error:', e instanceof Error ? e.message : String(e)));
});
