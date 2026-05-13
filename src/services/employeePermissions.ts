/**
 * Employee Permission Helpers v4 — Simple: has(key) or not.
 * Admin = everything (handled by permissionsService returning all keys).
 * User = only explicit grants from user_permissions.
 */
import { canEmployeesFieldView, type PermissionEntry } from './permissionsService';

export type EmployeeProfileTabId =
  | 'basic'
  | 'passport'
  | 'contract'
  | 'residency'
  | 'insurances'
  | 'work-status'
  | 'phones'
  | 'history'
  | 'documents';

const EMP = 'employees';

/** Map UI tab IDs to catalog keys */
const TAB_MAP: Record<EmployeeProfileTabId, string> = {
  'basic': 'tab.basic',
  'passport': 'tab.passport',
  'contract': 'tab.contract',
  'residency': 'tab.residency',
  'insurances': 'tab.insurances',
  'work-status': 'tab.workStatus',
  'phones': 'tab.phones',
  'history': 'tab.history',
  'documents': 'tab.documents',
};

/**
 * Can user see this tab?
 * Checks for employees:tab.{tabId} in permissions.
 */
export function canEmployeeUiTab(permissions: PermissionEntry[], tabId: EmployeeProfileTabId): boolean {
  const action = TAB_MAP[tabId];
  if (!action) return false;
  return permissions.some((p) => p.module === EMP && p.action === action);
}

/**
 * Can user see this field inside a tab?
 * Tab must be visible AND field must be granted.
 */
export function canEmployeeFieldInTab(
  permissions: PermissionEntry[] | undefined,
  tabId: EmployeeProfileTabId,
  fieldAction: string
): boolean {
  if (permissions == null) return true;
  if (!canEmployeeUiTab(permissions, tabId)) return false;
  return canEmployeesFieldView(permissions, fieldAction);
}

/** Map employee modal steps (1..5) to catalog tab */
export const EMPLOYEE_MODAL_STEP_TAB: Record<number, EmployeeProfileTabId> = {
  1: 'basic',
  2: 'passport',
  3: 'contract',
  4: 'residency',
  5: 'insurances',
};

// ─── Document filtering ──────────────────────────────────────────

const DOC_SECTIONS_LEGAL = new Set(['passport', 'mohre_contract', 'residency']);
const DOC_SECTIONS_FINANCIAL = new Set(['health_insurance', 'unemployment_insurance']);

export function filterEmployeeDocumentsByPermissions<T extends { section?: string | null }>(
  documents: T[],
  permissions: PermissionEntry[] | undefined
): T[] {
  if (permissions == null) return documents;

  const canLegal = permissions.some((p) => p.module === EMP && p.action === 'field.documentsLegal');
  const canFin = permissions.some((p) => p.module === EMP && p.action === 'field.documentsFinancial');

  // If no document field keys at all → show all (legacy compat)
  if (!canLegal && !canFin) {
    const hasAnyDocKey = permissions.some(
      (p) => p.module === EMP && (p.action === 'field.documentsLegal' || p.action === 'field.documentsFinancial')
    );
    if (!hasAnyDocKey) return documents;
    return [];
  }

  return documents.filter((d) => {
    const s = d.section || '';
    if (DOC_SECTIONS_LEGAL.has(s)) return canLegal;
    if (DOC_SECTIONS_FINANCIAL.has(s)) return canFin;
    return canLegal || canFin;
  });
}
