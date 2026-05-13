import { PERMISSION_CATALOG_V2 } from '../../src/permissions/permissionCatalogV2';

/**
 * Idempotent: inserts missing `permissions` catalog rows.
 * Admin (roleId=1) gets everything automatically via code — no role_permissions needed.
 */
export async function syncPermissionCatalog(
  query: (sql: string, params?: unknown[]) => Promise<unknown>,
): Promise<void> {
  for (const p of PERMISSION_CATALOG_V2) {
    await query('INSERT OR IGNORE INTO permissions (module, action, labelKey) VALUES (?, ?, ?)', [
      p.module,
      p.action,
      `${p.module}.${p.action}`,
    ]);
  }
  console.log(`✅ Permission catalog sync: ${PERMISSION_CATALOG_V2.length} entries ensured`);
}
