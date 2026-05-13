/**
 * Global Activity Log - Universal support for all modules (Employee, Branch, Vehicle, Housing, etc.)
 * Uses window.electronAPI.dbQuery - ensure user context from authStore when calling.
 */

export interface ActivityLogParams {
  module: string;       // 'employee' | 'branch' | 'vehicle' | 'housing' | ...
  action: string;       // 'status_change' | 'expiry_update' | 'create' | 'edit' | ...
  entityType: string;   // 'employee' | 'branch' | 'license' | 'lease' | ...
  entityId?: number;
  details: string;      // Human-readable or JSON
  performedByUserId?: number;
  performedByUsername?: string;
  performedByUserCode?: string; // e.g. RME0001 for display "Name (Code)"
}

export async function logActivity(params: ActivityLogParams): Promise<boolean> {
  const api = (window as unknown as { electronAPI?: { dbQuery?: (sql: string, params?: unknown[]) => Promise<{ success?: boolean }> } })
    .electronAPI;
  if (!api?.dbQuery) return false;
  try {
    const res = await api.dbQuery(
      `INSERT INTO activity_logs (module, action, entityType, entityId, details, performedByUserId, performedByUsername, performedByUserCode)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        params.module,
        params.action,
        params.entityType,
        params.entityId ?? null,
        params.details,
        params.performedByUserId ?? null,
        params.performedByUsername ?? null,
        params.performedByUserCode ?? null,
      ]
    );
    return !!res?.success;
  } catch {
    return false;
  }
}
