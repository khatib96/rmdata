import { SETTINGS_KEYS, DEFAULT_VALUES, LOCAL_ONLY_KEYS } from '../constants/settingsKeys';

/** Result from Main process db:query */
interface DbQueryResult<T = unknown> {
  success?: boolean;
  data?: T[];
  error?: string;
  lastInsertId?: number;
}

function runDbQuery<T = unknown>(
  query: string,
  params?: unknown[]
): Promise<DbQueryResult<T> | undefined> {
  if (!window.electronAPI?.dbQuery) return Promise.resolve(undefined);
  return window.electronAPI.dbQuery(query, params) as Promise<DbQueryResult<T>>;
}

export interface SettingsResult {
  success: boolean;
  error?: string;
}

export interface SettingRow {
  id: number;
  key: string;
  value: string | null;
  updatedAt: string | null;
}

const isDev = (import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV;

// ── Local settings helpers (JSON file in userData via IPC) ──────────────

async function getLocalSettings(): Promise<Record<string, string>> {
  try {
    const api = window.electronAPI as any;
    if (!api?.localSettingsGetAll) return {};
    const res = await api.localSettingsGetAll();
    return res?.success ? (res.data ?? {}) : {};
  } catch {
    return {};
  }
}

async function getLocalSettingValue(key: string): Promise<string | undefined> {
  try {
    const api = window.electronAPI as any;
    if (!api?.localSettingsGet) return undefined;
    const res = await api.localSettingsGet(key);
    return res?.success ? res.value : undefined;
  } catch {
    return undefined;
  }
}

async function saveLocalSettings(entries: Record<string, string>): Promise<SettingsResult> {
  try {
    const api = window.electronAPI as any;
    if (!api?.localSettingsSet) {
      return { success: false, error: 'localSettingsSet not available' };
    }
    const res = await api.localSettingsSet(entries);
    return { success: res?.success ?? false, error: res?.error };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// ── DB settings helpers ────────────────────────────────────────────────

async function ensureSettingsTable(): Promise<boolean> {
  try {
    const res = await runDbQuery('SELECT 1 FROM settings LIMIT 1');
    if (res?.success !== false) return true;
    if (!res?.error?.includes('no such table')) return true;
    const create = await runDbQuery(
      `CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT NOT NULL UNIQUE,
        value TEXT,
        updatedAt TEXT DEFAULT (datetime('now'))
      )`
    );
    return create?.success !== false;
  } catch {
    return false;
  }
}

// ── Public API ─────────────────────────────────────────────────────────

export async function getAllSettings(): Promise<Record<string, string>> {
  // Start with defaults
  const out: Record<string, string> = { ...DEFAULT_VALUES };

  // 1) Read remote/DB settings (shared keys only)
  await ensureSettingsTable();
  const res = await runDbQuery<SettingRow>('SELECT key, value FROM settings');
  if (res !== undefined && res.success !== false) {
    for (const r of res?.data ?? []) {
      if (r.key != null && !LOCAL_ONLY_KEYS.has(r.key)) {
        out[r.key] = r.value ?? '';
      }
    }
  } else if (isDev && res?.error) {
    console.warn('[Settings] getAllSettings DB failed:', res.error);
  }

  // 2) Overlay local-only settings from JSON file
  const local = await getLocalSettings();
  for (const key of LOCAL_ONLY_KEYS) {
    if (key in local) {
      out[key] = local[key];
    }
  }

  return out;
}

export async function getSetting(key: string): Promise<string> {
  // Local-only key → read from JSON file
  if (LOCAL_ONLY_KEYS.has(key)) {
    const v = await getLocalSettingValue(key);
    return v ?? DEFAULT_VALUES[key] ?? '';
  }

  // Shared key → read from DB
  const res = await runDbQuery<SettingRow>('SELECT value FROM settings WHERE key = ?', [key]);
  if (res === undefined || res.success === false) {
    if (isDev && res?.error) console.warn('[Settings] getSetting failed:', res.error);
    return DEFAULT_VALUES[key] ?? '';
  }
  const row = res?.data?.[0];
  if (row?.value != null) return row.value;
  return DEFAULT_VALUES[key] ?? '';
}

export async function setSetting(key: string, value: string): Promise<SettingsResult> {
  // Local-only key → save to JSON file
  if (LOCAL_ONLY_KEYS.has(key)) {
    return saveLocalSettings({ [key]: value });
  }

  // Shared key → save to DB
  const api = window.electronAPI;
  if (!api?.dbQuery) {
    return { success: false, error: 'واجهة Electron غير متاحة' };
  }
  try {
    await ensureSettingsTable();
    const existing = await runDbQuery<SettingRow>('SELECT id FROM settings WHERE key = ?', [key]);
    if (existing?.success === false && existing?.error) {
      return { success: false, error: existing.error };
    }
    const sql = (existing?.data?.length)
      ? 'UPDATE settings SET value = ?, updatedAt = datetime(\'now\') WHERE key = ?'
      : 'INSERT INTO settings (key, value, updatedAt) VALUES (?, ?, datetime(\'now\'))';
    const params = (existing?.data?.length) ? [value, key] : [key, value];
    const updateRes = await api.dbQuery(sql, params);
    if (updateRes?.success === false) {
      return { success: false, error: updateRes.error ?? 'فشل الحفظ' };
    }
    return { success: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { success: false, error: msg || 'فشل الحفظ' };
  }
}

export async function setSettings(entries: Record<string, string>): Promise<SettingsResult> {
  // Split entries into local and shared
  const localEntries: Record<string, string> = {};
  const dbEntries: Record<string, string> = {};

  for (const [key, value] of Object.entries(entries)) {
    if (LOCAL_ONLY_KEYS.has(key)) {
      localEntries[key] = value;
    } else {
      dbEntries[key] = value;
    }
  }

  // Save local entries to JSON file
  if (Object.keys(localEntries).length > 0) {
    const localRes = await saveLocalSettings(localEntries);
    if (!localRes.success) return localRes;
  }

  // Save shared entries to DB
  if (Object.keys(dbEntries).length > 0) {
    const api = window.electronAPI;
    if (!api?.dbQuery) {
      return { success: false, error: 'واجهة Electron غير متاحة' };
    }
    try {
      await ensureSettingsTable();
      for (const [key, value] of Object.entries(dbEntries)) {
        const existing = await runDbQuery<SettingRow>('SELECT id FROM settings WHERE key = ?', [key]);
        if (existing?.success === false && existing?.error) {
          return { success: false, error: existing.error };
        }
        if (existing?.data?.length) {
          const updateRes = await api.dbQuery(
            'UPDATE settings SET value = ?, updatedAt = datetime(\'now\') WHERE key = ?',
            [value, key]
          );
          if (updateRes?.success === false) {
            return { success: false, error: updateRes.error ?? 'فشل الحفظ' };
          }
        } else {
          const insertRes = await api.dbQuery(
            'INSERT INTO settings (key, value, updatedAt) VALUES (?, ?, datetime(\'now\'))',
            [key, value]
          );
          if (insertRes?.success === false) {
            return { success: false, error: insertRes.error ?? 'فشل الحفظ' };
          }
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { success: false, error: msg || 'فشل الحفظ' };
    }
  }

  return { success: true };
}

/** Phase 0: check if Electron API is available (e.g. from renderer) */
export async function isSettingsApiAvailable(): Promise<boolean> {
  try {
    const pong = await window.electronAPI?.ping?.();
    return pong === 'pong';
  } catch {
    return false;
  }
}

export { SETTINGS_KEYS, DEFAULT_VALUES };
