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
  employees: { table: 'employees', module: 'employees', remotePath: 'employees', entityType: 'employee', archiveActions: ['archive'], clearNotificationsOnArchive: false },
  branches: { table: 'branches', module: 'branches', remotePath: 'branches', entityType: 'branch', archiveActions: ['edit'], clearNotificationsOnArchive: true },
  vehicles: { table: 'vehicles', module: 'vehicles', remotePath: 'vehicles', entityType: 'vehicle', archiveActions: ['edit'], clearNotificationsOnArchive: false },
  housing: { table: 'housing_units', module: 'housing', remotePath: 'housing', entityType: 'housing', archiveActions: ['edit'], clearNotificationsOnArchive: false },
  phones: { table: 'phones', module: 'phones', remotePath: 'phones', entityType: 'phone', archiveActions: ['edit'], clearNotificationsOnArchive: false },
  entities: { table: 'entities', module: 'entities', remotePath: 'entities', entityType: 'entity', archiveActions: ['edit'], clearNotificationsOnArchive: true },
  employers: { table: 'employers', module: 'employers', remotePath: 'employers', entityType: 'employer', archiveActions: ['edit'], clearNotificationsOnArchive: true },
} as const;

type ArchiveRestoreResource = keyof typeof ARCHIVE_RESTORE_RESOURCES;
type LocalQueryRunner = ReturnType<typeof AppDataSource.createQueryRunner>;

function getArchiveResourceConfig(resource: unknown) {
  const key = String(resource || '') as ArchiveRestoreResource;
  return Object.prototype.hasOwnProperty.call(ARCHIVE_RESTORE_RESOURCES, key)
    ? ARCHIVE_RESTORE_RESOURCES[key]
    : null;
}

function isMissingTableError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /no such table|doesn't exist|does not exist|ER_NO_SUCH_TABLE/i.test(msg);
}

async function runOptionalLocalQuery(qr: LocalQueryRunner, sql: string, params: unknown[] = []): Promise<void> {
  try {
    await qr.query(sql, params);
  } catch (err) {
    if (isMissingTableError(err)) return;
    throw err;
  }
}

async function allOptionalLocalQuery(qr: LocalQueryRunner, sql: string, params: unknown[] = []): Promise<unknown[]> {
  try {
    const rows = await qr.query(sql, params);
    return Array.isArray(rows) ? rows : [];
  } catch (err) {
    if (isMissingTableError(err)) return [];
    throw err;
  }
}

async function deletePermanentLocalRecord(qr: LocalQueryRunner, resource: ArchiveRestoreResource, id: number): Promise<void> {
  if (resource === 'employees') {
    await runOptionalLocalQuery(qr, 'DELETE FROM status_history WHERE entityType = ? AND entityId = ?', ['employee', id]);
    await runOptionalLocalQuery(qr, 'UPDATE vehicles SET responsibleEmployeeId = NULL WHERE responsibleEmployeeId = ?', [id]);
    await runOptionalLocalQuery(qr, 'DELETE FROM notifications WHERE entityType = ? AND entityId = ?', ['employee', id]);
  } else if (resource === 'branches') {
    await runOptionalLocalQuery(qr, 'DELETE FROM tax_entity_branches WHERE branchId = ?', [id]);
    await runOptionalLocalQuery(qr, 'DELETE FROM branch_custom_fields WHERE branchId = ?', [id]);
    await runOptionalLocalQuery(qr, 'DELETE FROM branch_establishments WHERE branchId = ?', [id]);
    const leases = await allOptionalLocalQuery(qr, 'SELECT id FROM branch_leases WHERE branchId = ?', [id]) as { id?: number }[];
    for (const lease of leases) {
      if (lease.id != null) await runOptionalLocalQuery(qr, 'DELETE FROM lease_installments WHERE leaseId = ?', [lease.id]);
    }
    await runOptionalLocalQuery(qr, 'DELETE FROM branch_leases WHERE branchId = ?', [id]);
    await runOptionalLocalQuery(qr, 'DELETE FROM branch_licenses WHERE branchId = ?', [id]);
    await runOptionalLocalQuery(qr, 'UPDATE employees SET workBranchId = NULL WHERE workBranchId = ?', [id]);
    await runOptionalLocalQuery(qr, 'DELETE FROM notifications WHERE entityType = ? AND entityId = ?', ['branch', id]);
  } else if (resource === 'vehicles') {
    await runOptionalLocalQuery(qr, 'DELETE FROM vehicle_custom_fields WHERE vehicleId = ?', [id]);
    await runOptionalLocalQuery(qr, 'DELETE FROM notifications WHERE entityType = ? AND entityId = ?', ['vehicle', id]);
  } else if (resource === 'phones') {
    await runOptionalLocalQuery(qr, 'DELETE FROM notifications WHERE entityType = ? AND entityId = ?', ['phone', id]);
  } else if (resource === 'housing') {
    await runOptionalLocalQuery(qr, 'DELETE FROM documents WHERE entityType = ? AND entityId = ?', ['housing', id]);
    await runOptionalLocalQuery(qr, 'UPDATE phones SET assignedHousingId = NULL WHERE assignedHousingId = ?', [id]);
    await runOptionalLocalQuery(qr, 'DELETE FROM notifications WHERE entityType = ? AND entityId = ?', ['housing', id]);
    await runOptionalLocalQuery(qr, 'DELETE FROM housing_installments WHERE housingId = ?', [id]);
    await runOptionalLocalQuery(qr, 'DELETE FROM housing_occupants WHERE housingUnitId = ?', [id]);
    await runOptionalLocalQuery(qr, 'DELETE FROM housing_custom_fields WHERE housingUnitId = ?', [id]);
  } else if (resource === 'entities') {
    await runOptionalLocalQuery(qr, 'DELETE FROM tax_payments WHERE entityId = ?', [id]);
    await runOptionalLocalQuery(qr, 'DELETE FROM tax_entity_branches WHERE entityId = ?', [id]);
    await runOptionalLocalQuery(qr, 'DELETE FROM notifications WHERE entityType = ? AND entityId = ?', ['entity', id]);
  } else if (resource === 'employers') {
    await runOptionalLocalQuery(qr, 'DELETE FROM branch_employers WHERE employerId = ?', [id]);
    await runOptionalLocalQuery(qr, 'UPDATE phones SET assignedEmployerId = NULL WHERE assignedEmployerId = ?', [id]);
    await runOptionalLocalQuery(qr, 'DELETE FROM notifications WHERE entityType = ? AND entityId = ?', ['employer', id]);
  }
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
    if (process.platform !== 'win32') {
      return { success: false, error: 'NOT_WINDOWS' };
    }
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

  async function hasLocalAnyPermission(
    sessionToken: string | null | undefined,
    candidates: Array<readonly [string, readonly string[]]>,
  ): Promise<boolean> {
    for (const [module, actions] of candidates) {
      if (await hasLocalPermission(sessionToken, module, actions)) return true;
    }
    return false;
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

  ipcMain.handle('archive:deletePermanent', async (_event, payload: { sessionToken?: string | null; resource?: string; id?: number }) => {
    try {
      const id = Number(payload?.id || 0);
      if (!Number.isInteger(id) || id <= 0) return { success: false, error: 'INVALID_ID' };
      const config = getArchiveResourceConfig(payload?.resource);
      if (!config) return { success: false, error: 'INVALID_RESOURCE' };

      const conf = getDbConnectionConfig();
      if (conf.mode === 'remote') {
        return await remoteApiJson<{ success: boolean; data?: { entityType: string }; error?: string }>(
          `/api/${config.remotePath}/${id}/permanent`,
          { method: 'DELETE' },
        );
      }

      const allowed = await hasLocalPermission(payload?.sessionToken, config.module, ['delete']);
      if (!allowed) return { success: false, error: 'FORBIDDEN' };
      if (!AppDataSource.isInitialized) await initializeDatabase();
      const qr = AppDataSource.createQueryRunner();
      await qr.connect();
      try {
        const rows = await qr.query(`SELECT id FROM ${config.table} WHERE id = ? LIMIT 1`, [id]);
        if (!Array.isArray(rows) || rows.length === 0) return { success: false, error: 'NOT_FOUND' };
        await qr.startTransaction();
        try {
          await deletePermanentLocalRecord(qr, payload.resource as ArchiveRestoreResource, id);
          await qr.query(`DELETE FROM ${config.table} WHERE id = ?`, [id]);
          await qr.commitTransaction();
        } catch (err) {
          await qr.rollbackTransaction();
          throw err;
        }
        return { success: true, data: { entityType: config.entityType } };
      } finally {
        await qr.release();
      }
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
        if (config.clearNotificationsOnArchive) {
          await qr.query('DELETE FROM notifications WHERE entityType = ? AND entityId = ?', [config.entityType, id]);
        }
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

  ipcMain.handle('tax:paymentCreate', async (_event, payload: {
    sessionToken?: string | null;
    payment?: {
      entityId?: unknown;
      type?: unknown;
      financialYear?: unknown;
      quarter?: unknown;
      periodFrom?: unknown;
      periodTo?: unknown;
      amount?: unknown;
      paymentDate?: unknown;
    };
  }) => {
    try {
      const payment = payload?.payment || {};
      const entityId = Number(payment.entityId || 0);
      const type = String(payment.type || '').trim();
      const financialYear = Number(payment.financialYear || 0);
      const quarter = payment.quarter == null || payment.quarter === '' ? null : Number(payment.quarter);
      const amount = Number(payment.amount);
      const paymentDate = String(payment.paymentDate || '').trim();
      const periodFrom = payment.periodFrom == null || payment.periodFrom === '' ? null : String(payment.periodFrom);
      const periodTo = payment.periodTo == null || payment.periodTo === '' ? null : String(payment.periodTo);
      if (
        !Number.isInteger(entityId) || entityId <= 0 ||
        !['vat', 'corporate'].includes(type) ||
        !Number.isInteger(financialYear) || financialYear <= 0 ||
        (quarter !== null && (!Number.isInteger(quarter) || quarter <= 0)) ||
        !Number.isFinite(amount) ||
        !paymentDate
      ) {
        return { success: false, error: 'INVALID_REQUEST' };
      }

      const body = { entityId, type, financialYear, quarter, periodFrom, periodTo, amount, paymentDate };
      const conf = getDbConnectionConfig();
      if (conf.mode === 'remote') {
        return await remoteApiJson<{ success: boolean; id?: number; error?: string }>(
          '/api/tax/payments',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          },
        );
      }

      const allowed = await hasLocalAnyPermission(payload?.sessionToken, [
        ['settings', ['edit']],
        ['entities', ['edit']],
      ]);
      if (!allowed) return { success: false, error: 'FORBIDDEN' };
      if (!AppDataSource.isInitialized) await initializeDatabase();
      const qr = AppDataSource.createQueryRunner();
      await qr.connect();
      try {
        await qr.query(
          `INSERT INTO tax_payments (entityId, type, financialYear, quarter, periodFrom, periodTo, amount, paymentDate)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [entityId, type, financialYear, quarter, periodFrom, periodTo, amount, paymentDate],
        );
        const rows = await qr.query('SELECT last_insert_rowid() AS id') as { id?: number }[];
        const id = Number(rows?.[0]?.id || 0) || undefined;
        return { success: true, id };
      } finally {
        await qr.release();
      }
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
  });

  ipcMain.handle('tax:paymentDelete', async (_event, payload: { sessionToken?: string | null; id?: unknown }) => {
    try {
      const id = Number(payload?.id || 0);
      if (!Number.isInteger(id) || id <= 0) return { success: false, error: 'INVALID_ID' };
      const conf = getDbConnectionConfig();
      if (conf.mode === 'remote') {
        return await remoteApiJson<{ success: boolean; error?: string }>(
          `/api/tax/payments/${id}`,
          { method: 'DELETE' },
        );
      }

      const allowed = await hasLocalAnyPermission(payload?.sessionToken, [
        ['settings', ['edit']],
        ['entities', ['edit']],
      ]);
      if (!allowed) return { success: false, error: 'FORBIDDEN' };
      if (!AppDataSource.isInitialized) await initializeDatabase();
      const qr = AppDataSource.createQueryRunner();
      await qr.connect();
      try {
        await qr.query('DELETE FROM tax_payments WHERE id = ?', [id]);
      } finally {
        await qr.release();
      }
      return { success: true };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
  });

  ipcMain.handle('tax:entityBranchesReplace', async (_event, payload: { sessionToken?: string | null; entityId?: unknown; branchIds?: unknown[] }) => {
    try {
      const entityId = Number(payload?.entityId || 0);
      if (!Number.isInteger(entityId) || entityId <= 0) return { success: false, error: 'INVALID_ID' };
      const branchIds = [...new Set((Array.isArray(payload?.branchIds) ? payload.branchIds : [])
        .map((x) => Number(x))
        .filter((x) => Number.isInteger(x) && x > 0))];

      const conf = getDbConnectionConfig();
      if (conf.mode === 'remote') {
        return await remoteApiJson<{ success: boolean; data?: { entityId: number; branchIds: number[] }; error?: string }>(
          `/api/tax/entity-branches/${entityId}`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ branchIds }),
          },
        );
      }

      const allowed = await hasLocalAnyPermission(payload?.sessionToken, [
        ['settings', ['edit']],
        ['entities', ['edit']],
      ]);
      if (!allowed) return { success: false, error: 'FORBIDDEN' };
      if (!AppDataSource.isInitialized) await initializeDatabase();
      const qr = AppDataSource.createQueryRunner();
      await qr.connect();
      await qr.startTransaction();
      try {
        await qr.query('DELETE FROM tax_entity_branches WHERE entityId = ?', [entityId]);
        for (const branchId of branchIds) {
          await qr.query('INSERT OR IGNORE INTO tax_entity_branches (entityId, branchId) VALUES (?, ?)', [entityId, branchId]);
        }
        await qr.commitTransaction();
      } catch (err) {
        await qr.rollbackTransaction();
        throw err;
      } finally {
        await qr.release();
      }
      return { success: true, data: { entityId, branchIds } };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
  });

  ipcMain.handle('employee:statusUpdate', async (_event, payload: {
    sessionToken?: string | null;
    employeeId?: unknown;
    employeeUpdate?: Record<string, unknown>;
    statusChanged?: boolean;
    previousStatus?: string | null;
    effectiveDate?: string | null;
    dateCorrection?: { mainDateChanged?: boolean; actionDate?: string | null } | null;
    performedByUserId?: number | null;
    performedByUsername?: string | null;
  }) => {
    try {
      const employeeId = Number(payload?.employeeId || 0);
      if (!Number.isInteger(employeeId) || employeeId <= 0) return { success: false, error: 'INVALID_ID' };
      const u = payload?.employeeUpdate || {};
      if (!u.status) return { success: false, error: 'INVALID_REQUEST' };

      const body = {
        employeeUpdate: u,
        statusChanged: !!payload?.statusChanged,
        previousStatus: payload?.previousStatus ?? null,
        effectiveDate: payload?.effectiveDate ?? null,
        dateCorrection: payload?.dateCorrection ?? null,
        performedByUserId: payload?.performedByUserId ?? null,
        performedByUsername: payload?.performedByUsername ?? null,
      };

      const conf = getDbConnectionConfig();
      if (conf.mode === 'remote') {
        return await remoteApiJson<{ success: boolean; error?: string }>(
          `/api/employees/${employeeId}/status`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          },
        );
      }

      const allowed = await hasLocalAnyPermission(payload?.sessionToken, [
        ['employees', ['action.changeStatus', 'edit']],
      ]);
      if (!allowed) return { success: false, error: 'FORBIDDEN' };
      const actor = await resolveActorFromSessionToken(payload?.sessionToken);
      if (!AppDataSource.isInitialized) await initializeDatabase();
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
      const qr = AppDataSource.createQueryRunner();
      await qr.connect();
      await qr.startTransaction();
      try {
        const dateCorrection = payload?.dateCorrection || null;
        if (dateCorrection?.mainDateChanged && dateCorrection.actionDate) {
          const lastRows = await qr.query(
            "SELECT id, startDate, endDate FROM status_history WHERE entityType = 'employee' AND entityId = ? ORDER BY startDate DESC LIMIT 1",
            [employeeId],
          ) as { id?: number; startDate?: string; endDate?: string | null }[];
          const last = lastRows[0];
          if (last?.id) {
            const endDate = last.endDate ? String(last.endDate).slice(0, 10) : null;
            const durationDays = endDate
              ? Math.round((new Date(endDate).getTime() - new Date(dateCorrection.actionDate).getTime()) / (1000 * 60 * 60 * 24))
              : 0;
            await qr.query('UPDATE status_history SET startDate = ?, durationDays = ? WHERE id = ?', [dateCorrection.actionDate, durationDays, last.id]);
          }
        }

        if (payload?.statusChanged) {
          const effectiveDate = String(payload.effectiveDate || '').slice(0, 10);
          if (!effectiveDate) throw new Error('EFFECTIVE_DATE_REQUIRED');
          const actorId = payload.performedByUserId ?? actor?.userId ?? null;
          const actorName = payload.performedByUsername ?? null;
          const lastRows = await qr.query(
            "SELECT id, startDate FROM status_history WHERE entityType = 'employee' AND entityId = ? ORDER BY startDate DESC LIMIT 1",
            [employeeId],
          ) as { id?: number; startDate?: string }[];
          const lastRecord = lastRows[0];
          if (lastRecord?.startDate) {
            const prevStart = String(lastRecord.startDate).slice(0, 10);
            const durationDays = Math.round((new Date(effectiveDate).getTime() - new Date(prevStart).getTime()) / (1000 * 60 * 60 * 24));
            await qr.query('UPDATE status_history SET endDate = ?, durationDays = ? WHERE id = ?', [effectiveDate, durationDays, lastRecord.id]);
          } else if (payload.previousStatus) {
            await qr.query(
              `INSERT INTO status_history (entityType, entityId, status, startDate, endDate, durationDays, performedByUserId, performedByUsername)
               VALUES ('employee', ?, ?, ?, ?, 0, ?, ?)`,
              [employeeId, payload.previousStatus, effectiveDate, effectiveDate, actorId, actorName],
            );
          }
          await qr.query(
            `INSERT INTO status_history (entityType, entityId, status, startDate, performedByUserId, performedByUsername)
             VALUES ('employee', ?, ?, ?, ?, ?)`,
            [employeeId, String(u.status), effectiveDate, actorId, actorName],
          );
        }

        await qr.query(
          `UPDATE employees SET
             status = ?, workBranchId = ?, profession = ?, professionKeys = ?, professionCustomTitle = ?,
             actualSalary = ?, loanType = ?, loanBranchId = ?, loanProfession = ?, loanSubStatus = ?,
             loanExpiryDate = ?, tempContractNumber = ?, loanSalary = ?, targetEntityName = ?,
             loanLeaveStartDate = ?, loanLeaveEndDate = ?, updatedAt = datetime('now')
           WHERE id = ?`,
          [...updateValues, employeeId],
        );
        await qr.commitTransaction();
      } catch (err) {
        await qr.rollbackTransaction();
        throw err;
      } finally {
        await qr.release();
      }
      return { success: true };
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
