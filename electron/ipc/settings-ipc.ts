import { ipcMain } from 'electron';
import { execFile } from 'child_process';
import { AppDataSource, initializeDatabase } from '../../src/database/data-source';
import { runDbQueryInternal } from '../db-query-internal';
import { sharedState } from '../shared-state';
import {
  getDbConnectionConfig, setDbConnectionConfig, normalizeApiBaseUrl, executeRemoteDbQueryOnce,
  storeRemotePassword, clearRemotePassword, clearRemoteApiSession, remoteApiJson
} from '../remote-api-utils';
import { getLocalSetting, getAllLocalSettings, setLocalSetting, setLocalSettings } from '../local-settings-store';
import { validateInsertSql } from '../../src/utils/sqlInsertValidator';
import { syncPermissionCatalog } from '../database/permission-catalog-sync';
import { assertDbQueryAllowed, inspectDbQuery } from '../sql-query-guard';
import { resolveActorFromSessionToken } from '../device-session-utils';

const ARCHIVE_RESTORE_RESOURCES = {
  employees: { table: 'employees', module: 'employees', remotePath: 'employees', entityType: 'employee', archiveActions: ['archive'] },
  branches: { table: 'branches', module: 'branches', remotePath: 'branches', entityType: 'branch', archiveActions: ['edit'] },
  vehicles: { table: 'vehicles', module: 'vehicles', remotePath: 'vehicles', entityType: 'vehicle', archiveActions: ['edit'] },
  housing: { table: 'housing_units', module: 'housing', remotePath: 'housing', entityType: 'housing', archiveActions: ['edit'] },
  phones: { table: 'phones', module: 'phones', remotePath: 'phones', entityType: 'phone', archiveActions: ['edit'] },
  entities: { table: 'entities', module: 'entities', remotePath: 'entities', entityType: 'entity', archiveActions: ['edit'] },
} as const;

type ArchiveRestoreResource = keyof typeof ARCHIVE_RESTORE_RESOURCES;

function getArchiveResourceConfig(resource: unknown) {
  const key = String(resource || '') as ArchiveRestoreResource;
  return Object.prototype.hasOwnProperty.call(ARCHIVE_RESTORE_RESOURCES, key)
    ? ARCHIVE_RESTORE_RESOURCES[key]
    : null;
}

export function registerSettingsHandlers() {
  ipcMain.handle('settings:ping', async () => 'pong');

  ipcMain.handle('localSettings:get', async (_event, key: string) => getLocalSetting(key));
  ipcMain.handle('localSettings:getAll', async () => getAllLocalSettings());
  ipcMain.handle('localSettings:set', async (_event, key: string, value: string) => setLocalSetting(key, value));
  ipcMain.handle('localSettings:setAll', async (_event, changes: Record<string, string>) => setLocalSettings(changes));

  ipcMain.handle('settings:getDatabaseConnection', async () => {
    const cfg = getDbConnectionConfig();
    const hasSession = !!sharedState.remoteApiSession?.token;
    const hasSavedToken = !!cfg.apiToken;
    return {
      ...cfg,
      authenticated: cfg.mode === 'remote' ? (hasSession || hasSavedToken) : true,
    };
  });

  ipcMain.handle('settings:setDatabaseConnection', async (_event, config: { mode: 'local' | 'remote'; apiBaseUrl?: string; apiUsername?: string; apiPassword?: string; apiToken?: string }) => {
    try {
      if (config.mode === 'local') {
        clearRemoteApiSession();
        clearRemotePassword();
        setDbConnectionConfig({ mode: 'local' });
        return { success: true, authenticated: true };
      }

      const base = normalizeApiBaseUrl(config.apiBaseUrl);
      const username = String(config.apiUsername || '').trim();
      const password = String(config.apiPassword || '');
      if (!base || !username || !password) {
        return { success: false, authenticated: false, error: 'REMOTE_NOT_CONFIGURED' };
      }

      const loginRes = await fetch(`${base}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
        signal: AbortSignal.timeout(15000),
      });
      const loginJson = await loginRes.json() as { success?: boolean; token?: string; user?: { id?: number }; error?: string };
      if (!loginRes.ok || !loginJson.success || !loginJson.token) {
        return { success: false, authenticated: false, error: loginJson.error || 'INVALID_CREDENTIALS' };
      }

      setDbConnectionConfig({
        mode: 'remote',
        apiBaseUrl: base,
        apiUsername: username,
        apiToken: loginJson.token,
      });
      storeRemotePassword(password);
      sharedState.remoteApiSession = { token: loginJson.token, apiBaseUrl: base, userId: loginJson.user?.id };
      return { success: true, authenticated: true };
    } catch (err) {
      return { success: false, authenticated: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle('settings:testApiConnection', async (_event, baseUrl: string, username?: string, password?: string) => {
    try {
      let url = String(baseUrl || '').trim().replace(/\/+$/, '');
      if (!url.startsWith('http')) url = `https://${url}`;
      url = url.replace(/\/api$/i, '');
      const loginRes = await fetch(`${url}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username || '', password: password || '' }),
        signal: AbortSignal.timeout(10000),
      });
      const json = await loginRes.json() as { success: boolean; token?: string; error?: string };
      if (!loginRes.ok || !json.success) return { success: false, ok: false, error: json.error || `HTTP ${loginRes.status}` };
      return { success: true, ok: true, database: true, token: json.token };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle('device:ping', async (_event, token: string, gpsCoords: string | null, locationCity: string | null | undefined) => {
    try {
      if (!token) return { forceLogout: false as const };
      const check = await runDbQueryInternal('SELECT id FROM connected_devices WHERE token = ? LIMIT 1', [token]);
      if (!check.success) return { forceLogout: false as const, error: check.error || 'PING_FAILED' };
      if (!check.data?.length) return { forceLogout: true as const };
      const updateParams: unknown[] = [];
      let sql = "UPDATE connected_devices SET lastActive = datetime('now')";
      if (gpsCoords) { sql += ', gpsCoordinates = ?'; updateParams.push(gpsCoords); }
      if (locationCity !== undefined) { sql += ', locationCity = ?'; updateParams.push(locationCity); }
      sql += ' WHERE token = ?';
      updateParams.push(token);
      const upd = await runDbQueryInternal(sql, updateParams);
      if (!upd.success) return { forceLogout: false as const, error: upd.error || 'PING_UPDATE_FAILED' };
      return { forceLogout: false as const };
    } catch (err) {
      return { forceLogout: false as const, error: String(err) };
    }
  });

  ipcMain.handle('device:logout', async (_event, token: string) => {
    try {
      if (!token) return { success: true };
      await runDbQueryInternal('DELETE FROM connected_devices WHERE token = ?', [token]);
      if (sharedState.currentSessionToken === token) sharedState.currentSessionToken = null;
      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  const POWERSHELL_GEO_SCRIPT = `
Add-Type -AssemblyName System.Device
$w = New-Object System.Device.Location.GeoCoordinateWatcher([System.Device.Location.GeoPositionAccuracy]::Default)
$w.Start()
$timeout = 15
$elapsed = 0
while ($w.Status -ne 'Ready' -and $elapsed -lt $timeout) { Start-Sleep -Milliseconds 500; $elapsed += 0.5 }
if ($w.Status -eq 'Ready' -and $w.Position.Location.Latitude -ne [double]::NaN) {
  Write-Output "\$($w.Position.Location.Latitude)|\$($w.Position.Location.Longitude)"
} else { Write-Error "LOCATION_UNAVAILABLE: status=$($w.Status)" }
$w.Stop()
`;

  ipcMain.handle('get-windows-location', async () => {
    return new Promise((resolve) => {
      const ps = execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', POWERSHELL_GEO_SCRIPT], { timeout: 25000 }, (err, stdout, stderr) => {
        if (err) return resolve({ success: false, error: stderr?.trim() || err.message });
        const parts = (stdout || '').trim().split('|');
        if (parts.length !== 2) return resolve({ success: false, error: 'INVALID_OUTPUT' });
        const lat = parseFloat(parts[0]), lng = parseFloat(parts[1]);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return resolve({ success: false, error: 'INVALID_COORDS' });
        resolve({ success: true, lat, lng });
      });
      ps.stdin?.end();
    });
  });

  /** يضمن وجود كل صفوف الكتالوج في قاعدة البيانات النشطة (محلي أو بعيد) قبل عرض شاشة الصلاحيات */
  ipcMain.handle('permissions:syncCatalog', async () => {
    try {
      const conf = getDbConnectionConfig();
      if (conf.mode === 'remote') {
        await syncPermissionCatalog(async (sql, params) => {
          const r = await executeRemoteDbQueryOnce(sql, params ?? []);
          if (!r.success) throw new Error(r.error || 'REMOTE_QUERY_FAILED');
          return r.data;
        });
        return { success: true as const };
      }
      if (!AppDataSource.isInitialized) await initializeDatabase();
      const qr = AppDataSource.createQueryRunner();
      try {
        await syncPermissionCatalog((sql, p) => qr.query(sql, p));
      } finally {
        await qr.release();
      }
      return { success: true as const };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn('permissions:syncCatalog failed:', msg);
      return { success: false as const, error: msg };
    }
  });

  async function hasLocalPermission(sessionToken: string | null | undefined, module: string, actions: readonly string[]): Promise<boolean> {
    const actor = await resolveActorFromSessionToken(sessionToken);
    if (!actor) return false;
    if (actor.roleId === 1) return true;
    if (!actions.length) return false;
    const placeholders = actions.map(() => '?').join(', ');
    const res = await runDbQueryInternal(
      `SELECT 1 FROM user_permissions up
       INNER JOIN permissions p ON p.id = up.permissionId
       WHERE up.userId = ? AND p.module = ? AND p.action IN (${placeholders})
       LIMIT 1`,
      [actor.userId, module, ...actions],
    );
    return !!res.success && Array.isArray(res.data) && res.data.length > 0;
  }

  async function hasLocalSettingsPermission(sessionToken: string | null | undefined, action: 'sub.permissions' | 'edit'): Promise<boolean> {
    return hasLocalPermission(sessionToken, 'settings', [action]);
  }

  ipcMain.handle('permissions:getUserPermissions', async (_event, payload: { sessionToken?: string | null; userId?: number }) => {
    try {
      const userId = Number(payload?.userId || 0);
      if (!userId) return { success: false, error: 'INVALID_ID' };
      const conf = getDbConnectionConfig();
      if (conf.mode === 'remote') {
        return await remoteApiJson<{ success: boolean; data?: { permissionId: number }[]; error?: string }>(
          `/api/users/${userId}/permissions`,
        );
      }
      const allowed = await hasLocalSettingsPermission(payload?.sessionToken, 'sub.permissions');
      if (!allowed) return { success: false, error: 'FORBIDDEN' };
      const res = await runDbQueryInternal(
        'SELECT permissionId FROM user_permissions WHERE userId = ? ORDER BY permissionId',
        [userId],
      );
      return { success: res.success, data: res.data || [], error: res.error };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
  });

  ipcMain.handle('permissions:setUserPermissions', async (_event, payload: { sessionToken?: string | null; userId?: number; permissionIds?: unknown[] }) => {
    try {
      const userId = Number(payload?.userId || 0);
      if (!userId) return { success: false, error: 'INVALID_ID' };
      const rawPermissionIds = Array.isArray(payload?.permissionIds) ? payload.permissionIds : [];
      const permissionIds = [...new Set(rawPermissionIds
        .map((x) => Number(x))
        .filter((x) => Number.isInteger(x) && x > 0))];
      const conf = getDbConnectionConfig();
      if (conf.mode === 'remote') {
        return await remoteApiJson<{ success: boolean; data?: { permissionIds: number[] }; error?: string }>(
          `/api/users/${userId}/permissions`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ permissionIds }),
          },
        );
      }

      const allowed = await hasLocalSettingsPermission(payload?.sessionToken, 'edit');
      if (!allowed) return { success: false, error: 'FORBIDDEN' };
      if (!AppDataSource.isInitialized) await initializeDatabase();
      const target = await runDbQueryInternal('SELECT id, roleId FROM users WHERE id = ? LIMIT 1', [userId]);
      const targetRow = target.data?.[0] as { roleId?: number } | undefined;
      if (!target.success || !targetRow) return { success: false, error: 'NOT_FOUND' };
      if (Number(targetRow.roleId) === 1) return { success: false, error: 'ADMIN_IMMUTABLE' };

      const qr = AppDataSource.createQueryRunner();
      await qr.connect();
      await qr.startTransaction();
      try {
        await qr.query('DELETE FROM user_permissions WHERE userId = ?', [userId]);
        for (const permissionId of permissionIds) {
          await qr.query('INSERT OR IGNORE INTO user_permissions (userId, permissionId) VALUES (?, ?)', [userId, permissionId]);
        }
        await qr.query("UPDATE users SET permissionVersion = COALESCE(permissionVersion, 1) + 1, updatedAt = datetime('now') WHERE id = ?", [userId]);
        await qr.commitTransaction();
      } catch (err) {
        await qr.rollbackTransaction();
        throw err;
      } finally {
        await qr.release();
      }
      return { success: true, data: { permissionIds } };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
  });

  ipcMain.handle('archive:archive', async (_event, payload: { sessionToken?: string | null; resource?: string; id?: number }) => {
    try {
      const id = Number(payload?.id || 0);
      if (!Number.isInteger(id) || id <= 0) return { success: false, error: 'INVALID_ID' };
      const config = getArchiveResourceConfig(payload?.resource);
      if (!config) return { success: false, error: 'INVALID_RESOURCE' };

      const conf = getDbConnectionConfig();
      if (conf.mode === 'remote') {
        return await remoteApiJson<{ success: boolean; data?: { entityType: string }; error?: string }>(
          `/api/${config.remotePath}/${id}/archive`,
          { method: 'POST' },
        );
      }

      const allowed = await hasLocalPermission(payload?.sessionToken, config.module, config.archiveActions);
      if (!allowed) return { success: false, error: 'FORBIDDEN' };
      if (!AppDataSource.isInitialized) await initializeDatabase();
      const qr = AppDataSource.createQueryRunner();
      await qr.connect();
      try {
        const rows = await qr.query(`SELECT id FROM ${config.table} WHERE id = ? LIMIT 1`, [id]);
        if (!Array.isArray(rows) || rows.length === 0) return { success: false, error: 'NOT_FOUND' };
        await qr.query(`UPDATE ${config.table} SET status = 'archived', updatedAt = datetime('now') WHERE id = ?`, [id]);
        return { success: true, data: { entityType: config.entityType } };
      } finally {
        await qr.release();
      }
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
  });

  ipcMain.handle('archive:restore', async (_event, payload: { sessionToken?: string | null; resource?: string; id?: number }) => {
    try {
      const id = Number(payload?.id || 0);
      if (!Number.isInteger(id) || id <= 0) return { success: false, error: 'INVALID_ID' };
      const config = getArchiveResourceConfig(payload?.resource);
      if (!config) return { success: false, error: 'INVALID_RESOURCE' };

      const conf = getDbConnectionConfig();
      if (conf.mode === 'remote') {
        return await remoteApiJson<{ success: boolean; data?: { entityType: string }; error?: string }>(
          `/api/${config.remotePath}/${id}/restore`,
          { method: 'POST' },
        );
      }

      const allowed = await hasLocalPermission(payload?.sessionToken, config.module, ['edit']);
      if (!allowed) return { success: false, error: 'FORBIDDEN' };
      if (!AppDataSource.isInitialized) await initializeDatabase();
      const qr = AppDataSource.createQueryRunner();
      await qr.connect();
      try {
        const rows = await qr.query(`SELECT id FROM ${config.table} WHERE id = ? LIMIT 1`, [id]);
        if (!Array.isArray(rows) || rows.length === 0) return { success: false, error: 'NOT_FOUND' };
        await qr.query(`UPDATE ${config.table} SET status = 'active', updatedAt = datetime('now') WHERE id = ?`, [id]);
        return { success: true, data: { entityType: config.entityType } };
      } finally {
        await qr.release();
      }
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
  });

  ipcMain.handle('db:query', async (_event, query: string, params?: unknown[], internalToken?: string) => {
    try {
      assertDbQueryAllowed(query);
      validateInsertSql(query, params);
      const inspected = inspectDbQuery(query);
      if (inspected.isMutation) {
        console.warn(`[legacy-db-query] local ipc mutation: ${inspected.operation} ${inspected.table || 'unknown'}`);
      }
      const conf = getDbConnectionConfig();
      if (conf.mode === 'remote') {
        const res = await executeRemoteDbQueryOnce(query, params);
        if (!res.success) return { success: false, error: res.error || 'REMOTE_QUERY_FAILED' };
        return { success: true, data: res.data };
      }
      if (!AppDataSource.isInitialized) await initializeDatabase();
      const qr = AppDataSource.createQueryRunner();
      const rows = await qr.query(query, params);
      await qr.release();
      return { success: true, data: rows };
    } catch (e) {
      console.warn('DB Query main error:', e);
      return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
  });
  console.log("Settings IPC loaded");
}
