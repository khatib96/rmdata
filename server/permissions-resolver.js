/**
 * Permission Resolver v4 — Complete rewrite.
 * Admin (roleId=1): ALL permissions from catalog, no queries needed.
 * User: ONLY what's in user_permissions table.
 * No manage, no deny, no role_permissions.
 */
'use strict';

const { dbAll, dbRun } = require('./mysql-db.js');

const MAX_CACHE_ENTRIES = 500;
/** @type {Map<string, { entries: { module: string, action: string }[], permissionVersion: number, isAdmin: boolean }>} */
const lruCache = new Map();

function permKey(m, a) {
  return `${m}:${a}`;
}

function cacheGet(key) {
  const hit = lruCache.get(key);
  if (!hit) return null;
  lruCache.delete(key);
  lruCache.set(key, hit);
  return hit;
}

function cacheSet(key, value) {
  if (lruCache.size >= MAX_CACHE_ENTRIES) {
    const first = lruCache.keys().next().value;
    if (first !== undefined) lruCache.delete(first);
  }
  lruCache.set(key, value);
}

function invalidateUserPermissionCache(userId) {
  const uid = Number(userId);
  if (!uid) return;
  const prefix = `${uid}:`;
  for (const k of lruCache.keys()) {
    if (k.startsWith(prefix)) lruCache.delete(k);
  }
}

function clearAllPermissionCache() {
  lruCache.clear();
}

/**
 * Resolve effective permissions for a user.
 * Admin (roleId=1) = ALL permissions from catalog.
 * User = ONLY user_permissions entries.
 */
async function resolveEffectivePermissions(userId) {
  const uid = Number(userId);
  if (!uid) {
    return { entries: [], permissionVersion: 1, isAdmin: false };
  }

  const ur = await dbAll(
    `SELECT u.id, u.roleId,
            COALESCE(u.permissionVersion, 1) AS permVer,
            r.name AS roleName
     FROM users u
     LEFT JOIN roles r ON r.id = u.roleId
     WHERE u.id = ?
     LIMIT 1`,
    [uid]
  );
  const row = ur[0];
  if (!row) {
    return { entries: [], permissionVersion: 1, isAdmin: false };
  }

  const permVer = Number(row.permVer) || 1;
  const cacheKey = `${uid}:${permVer}`;
  const hit = cacheGet(cacheKey);
  if (hit) return hit;

  const roleId = Number(row.roleId);
  const isAdmin = roleId === 1;

  let entries;

  if (isAdmin) {
    // Admin = ALL permissions from catalog
    const all = await dbAll('SELECT module, action FROM permissions');
    entries = all.map((p) => ({ module: p.module, action: p.action }));
  } else {
    // User = ONLY user_permissions (no role_permissions, no deny)
    const granted = await dbAll(
      `SELECT p.module, p.action FROM user_permissions up
       INNER JOIN permissions p ON p.id = up.permissionId
       WHERE up.userId = ?`,
      [uid]
    );
    entries = granted.map((p) => ({ module: p.module, action: p.action }));
  }

  const result = { entries, permissionVersion: permVer, isAdmin };
  cacheSet(cacheKey, result);
  return result;
}

/**
 * Check if user has a specific permission.
 */
async function hasPermission(userId, module, action) {
  const { entries } = await resolveEffectivePermissions(userId);
  return entries.some((e) => e.module === module && e.action === action);
}

/**
 * Bump permission version after changes.
 */
async function bumpPermissionVersion(userId) {
  const uid = Number(userId);
  if (!uid) return;
  await dbRun('UPDATE users SET permissionVersion = permissionVersion + 1, updatedAt = NOW() WHERE id = ?', [uid]);
  invalidateUserPermissionCache(uid);
}

module.exports = {
  resolveEffectivePermissions,
  hasPermission,
  invalidateUserPermissionCache,
  bumpPermissionVersion,
  clearAllPermissionCache,
};
