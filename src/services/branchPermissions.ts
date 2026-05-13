/**
 * Branch Permission Helpers v4 — Simple: has(key) or not.
 */
import { canBranchesFieldView, type PermissionEntry } from './permissionsService';

export type BranchProfileTabId =
  | 'basic'
  | 'licenses'
  | 'entity'
  | 'employees'
  | 'employers'
  | 'history'
  | 'documents'
  | 'phones';

const MOD = 'branches';

/** Map UI tab IDs to catalog keys */
const TAB_MAP: Record<BranchProfileTabId, string> = {
  'basic': 'tab.basic',
  'licenses': 'tab.licenses',
  'entity': 'tab.entity',
  'employees': 'tab.employees',
  'employers': 'tab.employers',
  'history': 'tab.history',
  'documents': 'tab.documents',
  'phones': 'tab.phones',
};

/**
 * Can user see this tab?
 */
export function canBranchUiTab(permissions: PermissionEntry[], tabId: BranchProfileTabId): boolean {
  const action = TAB_MAP[tabId];
  if (!action) return false;
  return permissions.some((p) => p.module === MOD && p.action === action);
}

/**
 * Field visibility for branches.field.* — delegates to permissionsService.
 */
export function canBranchFieldView(
  permissions: PermissionEntry[] | undefined,
  fieldAction: string
): boolean {
  return canBranchesFieldView(permissions, fieldAction);
}

/**
 * Tab visible then field.
 */
export function canBranchFieldInTab(
  permissions: PermissionEntry[] | undefined,
  tabId: BranchProfileTabId,
  fieldAction: string
): boolean {
  if (permissions == null) return true;
  if (!canBranchUiTab(permissions, tabId)) return false;
  return canBranchesFieldView(permissions, fieldAction);
}

// ─── Document filtering ──────────────────────────────────────────

const DOC_SECTION_TRADE = 'trade_license';
const DOC_SECTION_LEASE = 'lease';

export function filterBranchDocumentsByPermissions<T extends { section?: string | null }>(
  documents: T[],
  permissions: PermissionEntry[] | undefined
): T[] {
  if (permissions == null) return documents;

  const canTrade = permissions.some((p) => p.module === MOD && p.action === 'field.tradeLicense');
  const canLease = permissions.some((p) => p.module === MOD && p.action === 'field.leaseContract');

  // No document field keys at all → show all (legacy compat)
  if (!canTrade && !canLease) {
    const hasAnyDocKey = permissions.some(
      (p) => p.module === MOD && (p.action === 'field.tradeLicense' || p.action === 'field.leaseContract')
    );
    if (!hasAnyDocKey) return documents;
    return [];
  }

  return documents.filter((d) => {
    const s = d.section || '';
    if (s === DOC_SECTION_TRADE) return canTrade;
    if (s === DOC_SECTION_LEASE) return canLease;
    return canTrade || canLease;
  });
}
