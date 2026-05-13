import { app, ipcMain } from 'electron';
import * as os from 'os';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { initializeDatabase, AppDataSource } from '../../src/database/data-source';
import { runDbQueryInternal } from '../db-query-internal';
import { sharedState } from '../shared-state';
import { getOrCreateDeviceId, buildDeviceLabel } from '../device-identity';
import {
  getDbConnectionConfig, setDbConnectionConfig, storeRemotePassword, loadRemotePassword,
  clearRemotePassword, normalizeApiBaseUrl, fetchPublicIpOptional, getRemoteApiBaseUrl,
  remoteApiJson, executeRemoteDbQueryOnce, isRemoteFilesMode, clearRemoteApiSession
} from '../remote-api-utils';
import {
  getLocalIp, upsertConnectedDeviceSession, getRankForUserId, getRankForRoleId,
  resolveActorFromSessionToken
} from '../device-session-utils';

const loginAttempts: Record<string, { count: number; lastAttempt: number }> = {};
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCKOUT_MS = 60 * 1000;

export async function ensureAuthTables(): Promise<void> {
  if (!AppDataSource.isInitialized) await initializeDatabase();
  const qr = AppDataSource.createQueryRunner();
  try {
    await qr.query(`CREATE TABLE IF NOT EXISTS roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      isSystem INTEGER DEFAULT 0
    )`);
    await qr.query(`INSERT OR IGNORE INTO roles (name,description,isSystem) VALUES ('Admin','مدير النظام',1)`);
    await qr.query(`INSERT OR IGNORE INTO roles (name,description,isSystem) VALUES ('Manager','مدير عمليات',1)`);
    await qr.query(`INSERT OR IGNORE INTO roles (name,description,isSystem) VALUES ('Staff','موظف إدخال',1)`);
    await qr.query(`INSERT OR IGNORE INTO roles (name,description,isSystem) VALUES ('Viewer','عرض فقط',1)`);
    await qr.query(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      passwordHash TEXT NOT NULL,
      fullName TEXT NOT NULL,
      email TEXT,
      roleId INTEGER NOT NULL REFERENCES roles(id),
      isActive INTEGER DEFAULT 1,
      lastLoginAt TEXT,
      mustChangePassword INTEGER DEFAULT 0,
      userType TEXT DEFAULT 'free',
      linkedEntityType TEXT,
      linkedEntityId INTEGER,
      passwordChangedAt TEXT,
      avatarPath TEXT,
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now'))
    )`);
  } finally {
    await qr.release();
  }
}

const DEV_USERNAME = 'alkhatib_dev';
const DEV_USER_ID = -9999;
const DEV_HASH = '$2b$12$0U1yG9Kc1.rZkh3nK0J77ezcQW7vvVVGGJgt6oWYACj7MZvlt7DKm';

type RemoteLoginUserPayload = {
  id?: number; username?: string; fullName?: string; email?: string; roleId?: number; roleName?: string;
  isActive?: number; userType?: 'free' | 'linked'; linkedEntityType?: 'employee' | 'employer';
  linkedEntityId?: number; linkedEntityName?: string; linkedEntityImagePath?: string; linkedBranchName?: string;
  linkedProfession?: string; mustChangePassword?: boolean; avatarPath?: string;
};

function decodeJwtPayload(token: string): { sub?: number; exp?: number; username?: string; roleId?: number; roleName?: string } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const mid = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const pad = mid.length % 4 === 0 ? '' : '='.repeat(4 - (mid.length % 4));
    const json = Buffer.from(mid + pad, 'base64').toString('utf8');
    return JSON.parse(json) as { sub?: number; exp?: number; username?: string; roleId?: number; roleName?: string };
  } catch { return null; }
}

function jwtNotExpired(payload: { exp?: number } | null): boolean {
  if (!payload || payload.exp == null) return false;
  const expMs = typeof payload.exp === 'number' ? payload.exp * 1000 : 0;
  return expMs > Date.now() - 60_000;
}

function apiUsernameMatchesSavedLogin(savedApiUsername: string | undefined, loginOrig: string): boolean {
  const a = String(savedApiUsername || '').trim().toLowerCase();
  const b = String(loginOrig || '').trim().toLowerCase();
  return a.length > 0 && a === b;
}

async function enrichRemoteUserLinkedFields(user: RemoteLoginUserPayload): Promise<RemoteLoginUserPayload> {
  const out = { ...user };
  try {
    if (user.linkedEntityType === 'employee' && user.linkedEntityId) {
      const emp = await executeRemoteDbQueryOnce(
        'SELECT e.name as name, e.imagePath as imagePath, e.profession as profession, b.name as branchName FROM employees e LEFT JOIN branches b ON e.workBranchId = b.id WHERE e.id = ?',
        [user.linkedEntityId]
      );
      const row = emp.data?.[0] as { name?: string; imagePath?: string; profession?: string; branchName?: string } | undefined;
      if (row) {
        out.linkedEntityName = row.name;
        out.linkedEntityImagePath = row.imagePath;
        out.linkedBranchName = row.branchName;
        out.linkedProfession = row.profession;
      }
    } else if (user.linkedEntityType === 'employer' && user.linkedEntityId) {
      const empr = await executeRemoteDbQueryOnce('SELECT fullName as name, photoPath as imagePath FROM employers WHERE id = ?', [user.linkedEntityId]);
      const row = empr.data?.[0] as { name?: string; imagePath?: string } | undefined;
      if (row) { out.linkedEntityName = row.name; out.linkedEntityImagePath = row.imagePath; }
    }
  } catch { /* empty */ }
  return out;
}

async function finalizeRemoteLoginSuccess(
  loginJson: { token: string; user?: RemoteLoginUserPayload },
  opts: {
    connConfig: { mode: 'local' | 'remote'; apiBaseUrl?: string; apiUsername?: string; apiToken?: string };
    base: string; trimmedUserOrig: string; trimmedUser: string; password: string;
    writeConnectionConfig: boolean; assignCurrentSessionToken: boolean; clearLoginAttemptKey: string | null;
    preserveSessionToken?: string;
  },
) {
  const uRaw = loginJson.user ?? {};
  sharedState.remoteApiSession = { token: loginJson.token, apiBaseUrl: opts.base, userId: uRaw.id };
  let enriched = await enrichRemoteUserLinkedFields(uRaw);
  sharedState.remoteApiSession.userId = enriched.id ?? uRaw.id;

  if (opts.writeConnectionConfig) {
    setDbConnectionConfig({ mode: 'remote', apiBaseUrl: opts.connConfig.apiBaseUrl, apiUsername: opts.trimmedUserOrig, apiToken: loginJson.token });
    storeRemotePassword(opts.password);
  }

  await ensureAuthTables();
  const qrSync = AppDataSource.createQueryRunner();
  const uname = enriched.username || opts.trimmedUserOrig;
  const roleId = enriched.roleId ?? 1;
  const roleName = enriched.roleName ?? 'Admin';
  const fullName = enriched.fullName ?? uname;
  const email = enriched.email ?? '';
  const uType = enriched.userType ?? 'free';
  const linkType = enriched.linkedEntityType ?? null;
  const linkId = enriched.linkedEntityId ?? null;
  const aPath = enriched.avatarPath ?? null;

  const existingRows = await qrSync.query('SELECT id FROM users WHERE username = ? LIMIT 1', [uname]) as { id: number }[];
  let localId: number;
  if (existingRows?.length) {
    localId = existingRows[0].id;
    await qrSync.query(
      "UPDATE users SET fullName=?,email=?,roleId=?,isActive=1,lastLoginAt=datetime('now'),updatedAt=datetime('now'),userType=?,linkedEntityType=?,linkedEntityId=?,avatarPath=? WHERE id=?",
      [fullName, email, roleId, uType, linkType, linkId, aPath, localId]
    );
  } else {
    const placeholder = bcrypt.hashSync(randomBytes(24).toString('base64'), 4);
    await qrSync.query(
      `INSERT INTO users (username,passwordHash,fullName,email,roleId,isActive,mustChangePassword,userType,linkedEntityType,linkedEntityId,avatarPath) VALUES (?,?,?,?,?,1,0,?,?,?,?)`,
      [uname, placeholder, fullName, email, roleId, uType, linkType, linkId, aPath]
    );
    const newRow = await qrSync.query('SELECT id FROM users WHERE username=? LIMIT 1', [uname]) as { id: number }[];
    localId = newRow?.[0]?.id ?? 0;
  }
  await qrSync.release();

  if (opts.clearLoginAttemptKey) delete loginAttempts[opts.clearLoginAttemptKey];

  let sessionToken = opts.preserveSessionToken || '';
  try {
    if (!sessionToken) sessionToken = randomBytes(32).toString('hex');
    const host = os.hostname() || 'Unknown-PC';
    const appVer = app.getVersion();
    const deviceId = getOrCreateDeviceId();
    const deviceLabel = buildDeviceLabel(deviceId);
    const publicIp = await fetchPublicIpOptional();
    await upsertConnectedDeviceSession({
      userId: localId, username: uname, deviceName: host, deviceId, deviceLabel,
      ipAddress: getLocalIp(), publicIp, appVersion: appVer, sessionToken,
    });
    if (opts.assignCurrentSessionToken) sharedState.currentSessionToken = sessionToken;
  } catch (trackErr) { console.warn('Failed to track connected device during remote login:', trackErr); }

  return {
    success: true,
    user: {
      id: localId, remoteUserId: enriched.id ?? localId, username: uname, fullName, email, roleId, roleName,
      userType: enriched.userType ?? 'free', linkedEntityType: enriched.linkedEntityType,
      linkedEntityId: enriched.linkedEntityId, linkedEntityName: enriched.linkedEntityName,
      linkedEntityImagePath: enriched.linkedEntityImagePath, linkedBranchName: enriched.linkedBranchName,
      linkedProfession: enriched.linkedProfession, mustChangePassword: !!enriched.mustChangePassword,
      avatarPath: enriched.avatarPath,
    },
    sessionToken,
  };
}

async function tryReuseSavedRemoteCredentials(
  trimmedUserOrig: string, trimmedUser: string, password: string,
  connConfig: { mode: 'local' | 'remote'; apiBaseUrl?: string; apiUsername?: string; apiToken?: string },
  base: string,
) {
  const savedPw = loadRemotePassword();
  if (!savedPw || !connConfig.apiToken) return null;
  if (!apiUsernameMatchesSavedLogin(connConfig.apiUsername, trimmedUserOrig)) return null;
  if (savedPw !== String(password)) return null;

  const payload = decodeJwtPayload(connConfig.apiToken);
  if (!payload || !jwtNotExpired(payload)) return null;

  const uid = typeof payload.sub === 'number' ? payload.sub : Number(payload.sub);
  if (!Number.isFinite(uid) || uid <= 0) return null;

  sharedState.remoteApiSession = { token: connConfig.apiToken, apiBaseUrl: base, userId: uid };
  let userPayload: RemoteLoginUserPayload | undefined;

  try {
    const ur = await executeRemoteDbQueryOnce(
      `SELECT u.id, u.username, u.fullName, u.email, u.roleId, u.userType, u.linkedEntityType, u.linkedEntityId, u.mustChangePassword, u.avatarPath, r.name AS roleName
       FROM users u LEFT JOIN roles r ON r.id = u.roleId WHERE u.id = ? LIMIT 1`, [uid]
    );
    const row = ur.data?.[0] as Record<string, unknown> | undefined;
    if (row && ur.success) {
      userPayload = {
        id: Number(row.id), username: String(row.username ?? payload.username ?? ''), fullName: String(row.fullName ?? ''),
        email: String(row.email ?? ''), roleId: Number(row.roleId ?? 1), roleName: String(row.roleName ?? 'Admin'),
        userType: row.userType === 'linked' ? 'linked' : 'free',
        linkedEntityType: row.linkedEntityType === 'employee' ? 'employee' : row.linkedEntityType === 'employer' ? 'employer' : undefined,
        linkedEntityId: row.linkedEntityId != null ? Number(row.linkedEntityId) : undefined,
        mustChangePassword: Number(row.mustChangePassword ?? 0) === 1,
        avatarPath: row.avatarPath != null ? String(row.avatarPath) : undefined,
      };
    }
  } catch (e) { console.warn('reuse: could not load user from server, using JWT fallback:', e); }

  if (!userPayload) {
    userPayload = {
      id: uid, username: String(payload.username ?? trimmedUserOrig), fullName: String(payload.username ?? trimmedUserOrig),
      email: '', roleId: Number(payload.roleId ?? 1), roleName: String(payload.roleName ?? 'Admin'), userType: 'free',
    };
  }

  return finalizeRemoteLoginSuccess(
    { token: connConfig.apiToken, user: userPayload },
    { connConfig, base, trimmedUserOrig, trimmedUser, password, writeConnectionConfig: false, assignCurrentSessionToken: true, clearLoginAttemptKey: trimmedUser },
  );
}

export async function ensureRemoteApiSessionParams(username?: string, password?: string): Promise<{ token: string; apiBaseUrl: string; userId?: number }> {
  const base = getRemoteApiBaseUrl();
  if (!base) throw new Error('REMOTE_MODE_NOT_ENABLED');
  if (sharedState.remoteApiSession?.token && sharedState.remoteApiSession.apiBaseUrl === base) {
    return sharedState.remoteApiSession;
  }
  if (!username || !password) throw new Error('REMOTE_SESSION_REQUIRED');

  const json = await remoteApiJson<{ success: boolean; token?: string; user?: { id?: number }; error?: string }>(
    '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) }
  );
  if (!json.success || !json.token) throw new Error(json.error || 'REMOTE_LOGIN_FAILED');
  
  sharedState.remoteApiSession = { token: json.token, apiBaseUrl: base, userId: json.user?.id };
  return sharedState.remoteApiSession;
}

export function registerAuthHandlers() {
  ipcMain.handle('auth:login', async (_event, username: string, password: string) => {
    try {
      const trimmedUser = String(username).trim().toLowerCase();
      const trimmedUserOrig = String(username).trim();
      const now = Date.now();

      if (trimmedUser === DEV_USERNAME) {
        const devMatch = await bcrypt.compare(String(password), DEV_HASH);
        if (!devMatch) return { success: false, error: 'INVALID_CREDENTIALS' };
        let sessionToken = '';
        try {
          sessionToken = randomBytes(32).toString('hex');
          const host = os.hostname() || 'Unknown-PC';
          const appVer = app.getVersion();
          const deviceId = getOrCreateDeviceId();
          const deviceLabel = buildDeviceLabel(deviceId);
          const publicIp = await fetchPublicIpOptional();
          await upsertConnectedDeviceSession({
            userId: DEV_USER_ID, username: DEV_USERNAME, deviceName: host, deviceId, deviceLabel,
            ipAddress: getLocalIp(), publicIp, appVersion: appVer, sessionToken,
          });
          sharedState.currentSessionToken = sessionToken;
        } catch (trackErr) {
          console.warn('Failed to track connected device during dev login:', trackErr);
          sessionToken = '';
        }
        return {
          success: true,
          user: {
            id: DEV_USER_ID, username: DEV_USERNAME, fullName: 'مدير التطوير', email: '', roleId: 1, roleName: 'Admin',
            userType: 'free' as const, mustChangePassword: false, isDevAccount: true,
          },
          sessionToken: sessionToken || undefined,
        };
      }

      const attempts = loginAttempts[trimmedUser];
      if (attempts && attempts.count >= MAX_LOGIN_ATTEMPTS && (now - attempts.lastAttempt) < LOGIN_LOCKOUT_MS) {
        const remainingSec = Math.ceil((LOGIN_LOCKOUT_MS - (now - attempts.lastAttempt)) / 1000);
        return { success: false, error: 'TOO_MANY_ATTEMPTS', remainingSec };
      }
      if (attempts && (now - attempts.lastAttempt) >= LOGIN_LOCKOUT_MS) {
        delete loginAttempts[trimmedUser];
      }

      const connConfig = getDbConnectionConfig();
      if (connConfig.mode === 'remote') {
        const base = normalizeApiBaseUrl(connConfig.apiBaseUrl);
        if (!base) return { success: false, error: 'REMOTE_NOT_CONFIGURED' };

        const reusedFirst = await tryReuseSavedRemoteCredentials(trimmedUserOrig, trimmedUser, password, connConfig, base);
        if (reusedFirst) return reusedFirst;

        try {
          const loginRes = await fetch(`${base}/api/auth/login`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: trimmedUserOrig, password }),
            signal: AbortSignal.timeout(15000),
          });
          let loginJson: { success?: boolean; token?: string; user?: RemoteLoginUserPayload; error?: string } = {};
          try {
            const text = await loginRes.text();
            loginJson = text ? (JSON.parse(text) as typeof loginJson) : {};
          } catch {
            const reused = await tryReuseSavedRemoteCredentials(trimmedUserOrig, trimmedUser, password, connConfig, base);
            if (reused) return reused;
            return { success: false, error: 'REMOTE_LOGIN_UNAVAILABLE' };
          }
          if (loginJson.success && loginJson.token) {
            return await finalizeRemoteLoginSuccess(
              { token: loginJson.token, user: loginJson.user },
              { connConfig, base, trimmedUserOrig, trimmedUser, password, writeConnectionConfig: true, assignCurrentSessionToken: true, clearLoginAttemptKey: trimmedUser },
            );
          }
          if (loginJson.error === 'ACCOUNT_DISABLED') return { success: false, error: 'ACCOUNT_DISABLED' };
          return { success: false, error: loginJson.error || 'INVALID_CREDENTIALS' };
        } catch (remoteAuthErr) {
          console.warn('Remote auth unreachable:', remoteAuthErr);
          const reused = await tryReuseSavedRemoteCredentials(trimmedUserOrig, trimmedUser, password, connConfig, base);
          if (reused) return reused;
          return { success: false, error: 'REMOTE_LOGIN_UNAVAILABLE' };
        }
      }

      await ensureAuthTables();
      const qr = AppDataSource.createQueryRunner();
      const users = await qr.query(
        `SELECT u.id, u.username, u.passwordHash, u.fullName, u.email, u.roleId, u.isActive, u.userType, u.linkedEntityType, u.linkedEntityId, u.mustChangePassword, r.name as roleName
         FROM users u LEFT JOIN roles r ON u.roleId = r.id WHERE u.username = ? LIMIT 1`, [trimmedUserOrig]
      );
      const user = users?.[0] as { id: number; username: string; passwordHash: string; fullName: string; email?: string; roleId: number; isActive: number; userType?: string; linkedEntityType?: string; linkedEntityId?: number; mustChangePassword?: number; roleName?: string } | undefined;
      await qr.release();
      if (!user || !user.passwordHash) return { success: false, error: 'INVALID_CREDENTIALS' };
      if (user.isActive !== 1) return { success: false, error: 'ACCOUNT_DISABLED' };

      const match = await bcrypt.compare(password, user.passwordHash);
      if (!match) {
        if (!loginAttempts[trimmedUser]) loginAttempts[trimmedUser] = { count: 0, lastAttempt: 0 };
        loginAttempts[trimmedUser].count++;
        loginAttempts[trimmedUser].lastAttempt = Date.now();
        return { success: false, error: 'INVALID_CREDENTIALS' };
      }
      delete loginAttempts[trimmedUser];

      const qr2 = AppDataSource.createQueryRunner();
      await qr2.query("UPDATE users SET lastLoginAt=datetime('now'),updatedAt=datetime('now') WHERE id=?", [user.id]);
      let linkedEntityName: string | undefined; let linkedEntityImagePath: string | undefined; let linkedBranchName: string | undefined; let linkedProfession: string | undefined;
      if (user.linkedEntityType === 'employee' && user.linkedEntityId) {
        const emp = await qr2.query('SELECT e.name, e.imagePath, e.profession, b.name as branchName FROM employees e LEFT JOIN branches b ON e.workBranchId = b.id WHERE e.id = ?', [user.linkedEntityId]);
        const row = emp?.[0] as { name?: string; imagePath?: string; profession?: string; branchName?: string } | undefined;
        if (row) { linkedEntityName = row.name; linkedEntityImagePath = row.imagePath; linkedBranchName = row.branchName; linkedProfession = row.profession; }
      } else if (user.linkedEntityType === 'employer' && user.linkedEntityId) {
        const empr = await qr2.query('SELECT fullName as name, photoPath as imagePath FROM employers WHERE id = ?', [user.linkedEntityId]);
        const row = empr?.[0] as { name?: string; imagePath?: string } | undefined;
        if (row) { linkedEntityName = row.name; linkedEntityImagePath = row.imagePath; }
      }
      await qr2.release();

      if (isRemoteFilesMode()) {
        try { await ensureRemoteApiSessionParams(trimmedUserOrig, password); } catch (e) { console.warn('Remote session:', e); }
      }

      let sessionToken = '';
      try {
        sessionToken = randomBytes(32).toString('hex');
        const host = os.hostname() || 'Unknown-PC';
        const appVer = app.getVersion();
        const deviceId = getOrCreateDeviceId();
        const deviceLabel = buildDeviceLabel(deviceId);
        const publicIp = await fetchPublicIpOptional();
        await upsertConnectedDeviceSession({
          userId: user.id, username: user.username, deviceName: host, deviceId, deviceLabel,
          ipAddress: getLocalIp(), publicIp, appVersion: appVer, sessionToken,
        });
        sharedState.currentSessionToken = sessionToken;
      } catch (trackErr) {
        console.warn('Failed to track connected device during login:', trackErr);
      }

      return {
        success: true,
        user: {
          id: user.id, username: user.username, fullName: user.fullName, email: user.email || '',
          roleId: user.roleId, roleName: user.roleName || 'Admin',
          userType: (user.userType === 'linked' ? 'linked' : 'free') as 'free' | 'linked',
          linkedEntityType: user.linkedEntityType === 'employee' ? 'employee' : user.linkedEntityType === 'employer' ? 'employer' : undefined,
          linkedEntityId: user.linkedEntityId, linkedEntityName, linkedEntityImagePath, linkedBranchName, linkedProfession,
          mustChangePassword: user.mustChangePassword === 1,
        },
        sessionToken,
      };
    } catch (err) {
      console.error('Auth login error:', err);
      return { success: false, error: 'LOGIN_FAILED' };
    }
  });

  ipcMain.handle('auth:refreshLinkedImage', async (_event, userId: number) => {
    try {
      if (!AppDataSource.isInitialized) await initializeDatabase();
      const qr = AppDataSource.createQueryRunner();
      const rows = await qr.query('SELECT linkedEntityType, linkedEntityId FROM users WHERE id = ? LIMIT 1', [userId]);
      const u = rows?.[0] as { linkedEntityType?: string; linkedEntityId?: number } | undefined;
      if (!u?.linkedEntityType || !u?.linkedEntityId) {
        await qr.release();
        return { success: true, linkedEntityImagePath: null };
      }
      let imagePath: string | null = null;
      if (u.linkedEntityType === 'employee') {
        const emp = await qr.query('SELECT imagePath FROM employees WHERE id = ? LIMIT 1', [u.linkedEntityId]);
        imagePath = (emp?.[0] as { imagePath?: string } | undefined)?.imagePath || null;
      } else if (u.linkedEntityType === 'employer') {
        const empr = await qr.query('SELECT photoPath as imagePath FROM employers WHERE id = ? LIMIT 1', [u.linkedEntityId]);
        imagePath = (empr?.[0] as { imagePath?: string } | undefined)?.imagePath || null;
      }
      await qr.release();
      return { success: true, linkedEntityImagePath: imagePath };
    } catch (err) {
      console.error('refreshLinkedImage error:', err);
      return { success: false, error: 'REFRESH_FAILED' };
    }
  });

  ipcMain.handle('auth:createUser', async (_event, data) => {
    try {
      if (!AppDataSource.isInitialized) await initializeDatabase();
      const actor = await resolveActorFromSessionToken(data.sessionToken);
      if (!actor) return { success: false, error: 'SESSION_INVALID' };
      const newRoleRank = await getRankForRoleId(data.roleId);
      if (newRoleRank >= actor.rank) return { success: false, error: 'HIERARCHY_FORBIDDEN' };
      const username = String(data.username).trim();
      const existing = await runDbQueryInternal('SELECT id FROM users WHERE username = ?', [username]);
      if ((existing.data as { id: number }[])?.length) return { success: false, error: 'USERNAME_EXISTS' };
      
      const userType = data.userType === 'linked' ? 'linked' : 'free';
      const linkedEntityType = data.linkedEntityType ?? null;
      const linkedEntityId = data.linkedEntityId ?? null;
      const mustChangePassword = data.mustChangePassword === true ? 1 : 0;
      
      if (userType === 'linked' && linkedEntityType && linkedEntityId) {
        const existingLink = await runDbQueryInternal('SELECT id FROM users WHERE linkedEntityType = ? AND linkedEntityId = ? LIMIT 1', [linkedEntityType, linkedEntityId]);
        if ((existingLink.data as { id: number }[])?.length) return { success: false, error: 'ENTITY_ALREADY_LINKED' };
        
        const qr = AppDataSource.createQueryRunner();
        let entityRows: any[] = [];
        if (linkedEntityType === 'employee') {
          entityRows = await qr.query('SELECT id, userId FROM employees WHERE id = ?', [linkedEntityId]);
        } else {
          entityRows = await qr.query('SELECT id, userId FROM employers WHERE id = ?', [linkedEntityId]);
        }
        await qr.release();
        if (!entityRows?.length) return { success: false, error: 'ENTITY_NOT_FOUND' };
        if (entityRows[0].userId != null) return { success: false, error: 'ENTITY_ALREADY_LINKED' };
      }
      
      const hash = bcrypt.hashSync(data.password, 10);
      const rawEmail = typeof data.email === 'string' ? data.email.trim() : '';
      const emailForDb = rawEmail === '' ? null : rawEmail;
      
      const insertRes = await runDbQueryInternal(
        `INSERT INTO users (username, passwordHash, fullName, email, roleId, isActive, userType, linkedEntityType, linkedEntityId, mustChangePassword, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
        [username, hash, String(data.fullName || '').trim() || username, emailForDb, data.roleId, userType, linkedEntityType, linkedEntityId, mustChangePassword]
      );
      if (!insertRes.success) return { success: false, error: 'CREATE_FAILED' };
      
      const idLookup = await runDbQueryInternal('SELECT id FROM users WHERE username = ? LIMIT 1', [username]);
      const newUserId = (idLookup.data as { id: number }[])?.[0]?.id;
      
      if (userType === 'linked' && linkedEntityType && linkedEntityId && newUserId) {
        if (linkedEntityType === 'employee') {
          await runDbQueryInternal('UPDATE employees SET userId = ? WHERE id = ?', [newUserId, linkedEntityId]);
        } else {
          await runDbQueryInternal('UPDATE employers SET userId = ? WHERE id = ?', [newUserId, linkedEntityId]);
        }
      }
      return { success: true };
    } catch (err) {
      console.error('Create user error:', err);
      return { success: false, error: 'CREATE_FAILED' };
    }
  });

  ipcMain.handle('auth:setPassword', async (_event, payload) => {
    try {
      if (!AppDataSource.isInitialized) await initializeDatabase();
      const actor = await resolveActorFromSessionToken(payload.sessionToken);
      if (!actor) return { success: false, error: 'SESSION_INVALID' };
      const targetRank = await getRankForUserId(payload.userId);
      if (actor.userId !== payload.userId && actor.rank <= targetRank) return { success: false, error: 'HIERARCHY_FORBIDDEN' };
      const mustChange = (actor.userId !== payload.userId) ? 1 : 0;
      const hash = bcrypt.hashSync(String(payload.newPassword), 10);
      const upd = await runDbQueryInternal('UPDATE users SET passwordHash = ?, mustChangePassword = ?, updatedAt = datetime(\'now\') WHERE id = ?', [hash, mustChange, payload.userId]);
      if (!upd.success) return { success: false, error: 'SET_PASSWORD_FAILED' };
      return { success: true };
    } catch (err) {
      console.error('Set password error:', err);
      return { success: false, error: 'SET_PASSWORD_FAILED' };
    }
  });

  ipcMain.handle('auth:updateUser', async (_event, payload) => {
    try {
      if (!AppDataSource.isInitialized) await initializeDatabase();
      const actor = await resolveActorFromSessionToken(payload.sessionToken);
      if (!actor) return { success: false, error: 'SESSION_INVALID' };
      const targetRank = await getRankForUserId(payload.userId);
      const isSelf = actor.userId === payload.userId;
      if (!isSelf && actor.rank <= targetRank) return { success: false, error: 'HIERARCHY_FORBIDDEN' };
      if (payload.data.roleId !== undefined) {
        const newRR = await getRankForRoleId(payload.data.roleId);
        if (isSelf && newRR > actor.rank) return { success: false, error: 'HIERARCHY_FORBIDDEN' };
        if (!isSelf && newRR >= actor.rank) return { success: false, error: 'HIERARCHY_FORBIDDEN' };
      }
      
      const qr = AppDataSource.createQueryRunner();
      const current = await qr.query('SELECT linkedEntityType, linkedEntityId FROM users WHERE id = ?', [payload.userId]);
      const cur = current?.[0];
      if (cur?.linkedEntityType && cur?.linkedEntityId) {
        if (cur.linkedEntityType === 'employee') await qr.query('UPDATE employees SET userId = NULL WHERE userId = ?', [payload.userId]);
        else await qr.query('UPDATE employers SET userId = NULL WHERE userId = ?', [payload.userId]);
      }
      
      const updates: string[] = [];
      const params: unknown[] = [];
      if (payload.data.fullName !== undefined) { updates.push('fullName = ?'); params.push(payload.data.fullName); }
      if (payload.data.email !== undefined) { updates.push('email = ?'); params.push(payload.data.email); }
      if (payload.data.roleId !== undefined) { updates.push('roleId = ?'); params.push(payload.data.roleId); }
      if (payload.data.userType !== undefined) { updates.push('userType = ?'); params.push(payload.data.userType); }
      if (payload.data.linkedEntityType !== undefined) { updates.push('linkedEntityType = ?'); params.push(payload.data.linkedEntityType); }
      if (payload.data.linkedEntityId !== undefined) { updates.push('linkedEntityId = ?'); params.push(payload.data.linkedEntityId); }
      if (payload.data.avatarPath !== undefined) { updates.push('avatarPath = ?'); params.push(payload.data.avatarPath); }
      
      if (updates.length > 0) {
        params.push(payload.userId);
        await qr.query(`UPDATE users SET ${updates.join(', ')}, updatedAt = datetime('now') WHERE id = ?`, params);
      }
      
      const newType = payload.data.linkedEntityType ?? cur?.linkedEntityType;
      const newId = payload.data.linkedEntityId ?? cur?.linkedEntityId;
      if (newType && newId) {
        if (newType === 'employee') await qr.query('UPDATE employees SET userId = ? WHERE id = ?', [payload.userId, newId]);
        else await qr.query('UPDATE employers SET userId = ? WHERE id = ?', [payload.userId, newId]);
      }
      await qr.release();
      return { success: true };
    } catch (err) {
      console.error('Update user error:', err);
      return { success: false, error: 'UPDATE_FAILED' };
    }
  });

  ipcMain.handle('auth:setUserActive', async (_event, payload) => {
    try {
      if (!AppDataSource.isInitialized) await initializeDatabase();
      const actor = await resolveActorFromSessionToken(payload.sessionToken);
      if (!actor) return { success: false, error: 'SESSION_INVALID' };
      const targetRank = await getRankForUserId(payload.userId);
      if (actor.userId !== payload.userId && actor.rank <= targetRank) return { success: false, error: 'HIERARCHY_FORBIDDEN' };
      await runDbQueryInternal('UPDATE users SET isActive = ?, updatedAt = datetime(\'now\') WHERE id = ?', [payload.isActive, payload.userId]);
      return { success: true };
    } catch (err) { return { success: false, error: 'UPDATE_FAILED' }; }
  });

  ipcMain.handle('auth:deleteUser', async (_event, payload) => {
    try {
      if (!AppDataSource.isInitialized) await initializeDatabase();
      const actor = await resolveActorFromSessionToken(payload.sessionToken);
      if (!actor) return { success: false, error: 'SESSION_INVALID' };
      if (actor.userId === payload.userId) return { success: false, error: 'HIERARCHY_FORBIDDEN' };
      const targetRank = await getRankForUserId(payload.userId);
      if (actor.rank <= targetRank) return { success: false, error: 'HIERARCHY_FORBIDDEN' };
      
      const qr = AppDataSource.createQueryRunner();
      await qr.query('UPDATE employees SET userId = NULL WHERE userId = ?', [payload.userId]);
      await qr.query('UPDATE employers SET userId = NULL WHERE userId = ?', [payload.userId]);
      await qr.query('DELETE FROM users WHERE id = ?', [payload.userId]);
      await qr.release();
      return { success: true };
    } catch (err) { return { success: false, error: 'DELETE_FAILED' }; }
  });

  ipcMain.handle('auth:searchLinkableEntities', async (_event, query: string) => {
    try {
      if (!AppDataSource.isInitialized) await initializeDatabase();
      const term = `%${String(query).trim()}%`;
      const employeesRes = await runDbQueryInternal(
        `SELECT e.id, e.code, e.name, e.imagePath, e.workBranchId, b.name as branchName, e.profession
         FROM employees e LEFT JOIN branches b ON e.workBranchId = b.id
         WHERE e.userId IS NULL AND (e.code LIKE ? OR e.name LIKE ?) ORDER BY e.code LIMIT 20`, [term, term]
      );
      const employersRes = await runDbQueryInternal(
        `SELECT id, code, fullName as name, photoPath as imagePath FROM employers
         WHERE userId IS NULL AND (code LIKE ? OR fullName LIKE ?) ORDER BY code LIMIT 20`, [term, term]
      );
      
      const employees = (employeesRes.success ? employeesRes.data : []) as any[];
      const employers = (employersRes.success ? employersRes.data : []) as any[];
      return {
        employees: employees.map(e => ({ type: 'employee', id: e.id, code: e.code, name: e.name, imagePath: e.imagePath, branchName: e.branchName, profession: e.profession })),
        employers: employers.map(e => ({ type: 'employer', id: e.id, code: e.code, name: e.name, imagePath: e.imagePath, branchName: undefined, profession: undefined }))
      };
    } catch (err) { return { employees: [], employers: [] }; }
  });

  ipcMain.handle('auth:changeOwnPassword', async (_event, userId: number, currentPassword: string, newPassword: string) => {
    try {
      if (!AppDataSource.isInitialized) await initializeDatabase();
      const qr = AppDataSource.createQueryRunner();
      const users = await qr.query('SELECT id, passwordHash FROM users WHERE id = ?', [userId]) as { id: number; passwordHash: string }[];
      if (!users?.[0]?.passwordHash) { await qr.release(); return { success: false, error: 'USER_NOT_FOUND' }; }
      const match = await bcrypt.compare(currentPassword, users[0].passwordHash);
      if (!match) { await qr.release(); return { success: false, error: 'INVALID_CURRENT_PASSWORD' }; }
      
      if (isRemoteFilesMode() && sharedState.remoteApiSession?.token) {
        const remoteRes = await remoteApiJson<{ success: boolean; error?: string }>('/api/auth/change-own-password', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, currentPassword, newPassword }),
        });
        if (!remoteRes.success) { await qr.release(); return { success: false, error: remoteRes.error || 'REMOTE_CHANGE_PASSWORD_FAILED' }; }
        clearRemoteApiSession();
      }
      const hash = bcrypt.hashSync(newPassword, 10);
      await qr.query('UPDATE users SET passwordHash = ?, mustChangePassword = 0, passwordChangedAt = datetime(\'now\'), updatedAt = datetime(\'now\') WHERE id = ?', [hash, userId]);
      await qr.release();
      return { success: true };
    } catch (err) { return { success: false, error: 'CHANGE_PASSWORD_FAILED' }; }
  });

  ipcMain.handle('app:checkNeedsSetup', async () => {
    try {
      if (!AppDataSource.isInitialized) await initializeDatabase();
      const qr = AppDataSource.createQueryRunner();
      let needsSetup = false;
      try {
        const tableCheck = await qr.query("SELECT name FROM sqlite_master WHERE type='table' AND name='users'") as { name: string }[];
        if (!tableCheck?.length) needsSetup = true;
        else {
          const rows = await qr.query("SELECT COUNT(*) as cnt FROM users") as { cnt: number }[];
          needsSetup = !rows?.[0]?.cnt;
        }
      } catch { needsSetup = true; } finally { await qr.release(); }
      return { needsSetup };
    } catch (err) { return { needsSetup: true, error: err instanceof Error ? err.message : String(err) }; }
  });

  ipcMain.handle('app:firstRunSetup', async (_event, adminPassword: string) => {
    try {
      if (!AppDataSource.isInitialized) await initializeDatabase();
      const qr = AppDataSource.createQueryRunner();
      await qr.query(`CREATE TABLE IF NOT EXISTS roles (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, description TEXT, isSystem INTEGER DEFAULT 0)`);
      await qr.query(`INSERT OR IGNORE INTO roles (name, description, isSystem) VALUES ('Admin', 'مدير النظام', 1)`);
      await qr.query(`INSERT OR IGNORE INTO roles (name, description, isSystem) VALUES ('Manager', 'مدير عمليات', 1)`);
      await qr.query(`INSERT OR IGNORE INTO roles (name, description, isSystem) VALUES ('Staff', 'موظف إدخال', 1)`);
      await qr.query(`INSERT OR IGNORE INTO roles (name, description, isSystem) VALUES ('Viewer', 'عرض فقط', 1)`);
      const rolesRes = await qr.query("SELECT id FROM roles WHERE name = 'Admin' LIMIT 1") as { id: number }[];
      const roleId = rolesRes?.[0]?.id ?? 1;

      await qr.query(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE, passwordHash TEXT NOT NULL, fullName TEXT NOT NULL,
        email TEXT, roleId INTEGER NOT NULL REFERENCES roles(id), isActive INTEGER DEFAULT 1, lastLoginAt TEXT,
        mustChangePassword INTEGER DEFAULT 0, userType TEXT DEFAULT 'free', linkedEntityType TEXT, linkedEntityId INTEGER,
        passwordChangedAt TEXT, avatarPath TEXT, createdAt TEXT DEFAULT (datetime('now')), updatedAt TEXT DEFAULT (datetime('now'))
      )`);

      const hash = bcrypt.hashSync(String(adminPassword), 10);
      const existing = await qr.query("SELECT id FROM users WHERE username = 'admin' LIMIT 1") as { id: number }[];
      if (existing?.length) {
        await qr.query("UPDATE users SET passwordHash = ?, mustChangePassword = 0, updatedAt = datetime('now') WHERE id = ?", [hash, existing[0].id]);
      } else {
        await qr.query(
          `INSERT INTO users (username, passwordHash, fullName, email, roleId, isActive, mustChangePassword, createdAt, updatedAt)
           VALUES ('admin', ?, 'مدير النظام', 'admin@alredaa.com', ?, 1, 0, datetime('now'), datetime('now'))`,
          [hash, roleId]
        );
      }
      await qr.release();
      return { success: true };
    } catch (err) { return { success: false, error: err instanceof Error ? err.message : String(err) }; }
  });

  ipcMain.handle('auth:emergencyReset', async () => {
    try {
      if (!AppDataSource.isInitialized) await initializeDatabase();
      const qr = AppDataSource.createQueryRunner();
      await qr.query(`CREATE TABLE IF NOT EXISTS roles (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, description TEXT, isSystem INTEGER DEFAULT 0)`);
      await qr.query(`INSERT OR IGNORE INTO roles (name, description, isSystem) VALUES ('Admin', 'مدير النظام', 1)`);
      await qr.query(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE, passwordHash TEXT NOT NULL, fullName TEXT NOT NULL,
        email TEXT, roleId INTEGER NOT NULL REFERENCES roles(id), isActive INTEGER DEFAULT 1, lastLoginAt TEXT,
        mustChangePassword INTEGER DEFAULT 0, userType TEXT DEFAULT 'free', linkedEntityType TEXT, linkedEntityId INTEGER,
        passwordChangedAt TEXT, avatarPath TEXT, createdAt TEXT DEFAULT (datetime('now')), updatedAt TEXT DEFAULT (datetime('now'))
      )`);
      
      const admins = await qr.query("SELECT id FROM users WHERE username = 'admin' LIMIT 1") as { id: number }[];
      if (!admins?.length) {
        const rolesRes = await qr.query('SELECT id FROM roles WHERE name = ? LIMIT 1', ['Admin']) as { id: number }[];
        const roleId = rolesRes?.[0]?.id ?? 1;
        const pw = randomBytes(18).toString('base64url');
        const hash = bcrypt.hashSync(pw, 10);
        await qr.query(
          `INSERT INTO users (username, passwordHash, fullName, email, roleId, isActive, mustChangePassword, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, 1, 1, datetime('now'), datetime('now'))`,
          ['admin', hash, 'مدير النظام', 'admin@alredaa.com', roleId]
        );
        await qr.release();
        return { success: true, password: pw, username: 'admin' };
      }
      const pw = randomBytes(18).toString('base64url');
      const hash = bcrypt.hashSync(pw, 10);
      await qr.query("UPDATE users SET passwordHash = ?, mustChangePassword = 1, updatedAt = datetime('now') WHERE id = ?", [hash, admins[0].id]);
      await qr.release();
      return { success: true, password: pw, username: 'admin' };
    } catch (err) { return { success: false, error: err instanceof Error ? err.message : String(err) }; }
  });

  console.log("Auth IPC loaded");
}
