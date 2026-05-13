/**
 * Permission Service v4 — Complete rewrite from scratch.
 * 
 * Design:
 *   Admin (roleId=1) = ALL permissions, no DB query
 *   User  (roleId≠1) = ONLY what's in user_permissions table
 *   No manage, no deny, no role_permissions, no expansion
 */

import { getAllPermissionKeys } from '../permissions/permissionCatalogV2';

export interface PermissionEntry {
  module: string;
  action: string;
}

// ─── Cache ────────────────────────────────────────────────────────
let _cachedKey: string | null = null;
let _cachedPerms: Set<string> = new Set();

// ─── Admin set (all keys from catalog) ────────────────────────────
let _adminKeys: Set<string> | null = null;
function getAdminKeys(): Set<string> {
  if (!_adminKeys) _adminKeys = getAllPermissionKeys();
  return _adminKeys;
}

/**
 * Load effective permissions for a user.
 * Admin (roleId=1): returns ALL keys from catalog — no DB query.
 * User: returns only keys from user_permissions table via username subquery.
 */
export async function loadPermissions(
  userId: number,
  roleId: number,
  opts?: { remoteUserId?: number; username?: string; isDevAccount?: boolean }
): Promise<Set<string>> {
  // Dev backdoor
  if (userId === -9999 || opts?.isDevAccount) return getAdminKeys();

  // Admin = everything (Number() guards against string "1" from JSON)
  if (Number(roleId) === 1) return getAdminKeys();

  // Use username for cache + query (consistent across local/remote DBs)
  const username = opts?.username;
  const cacheKey = username || String(opts?.remoteUserId ?? userId);

  // Cache hit
  if (_cachedKey === cacheKey && _cachedPerms.size > 0) return _cachedPerms;

  const api = window.electronAPI;
  if (!api?.dbQuery) return new Set();

  try {
    let res;
    if (username) {
      // Username-based subquery — most reliable, works regardless of local/remote ID mismatch
      res = await api.dbQuery(
        `SELECT p.module, p.action
         FROM user_permissions up
         JOIN permissions p ON up.permissionId = p.id
         WHERE up.userId = (SELECT id FROM users WHERE username = ? LIMIT 1)`,
        [username]
      );
    } else {
      // Fallback: use remoteUserId if available, else userId
      const queryUserId = opts?.remoteUserId ?? userId;
      res = await api.dbQuery(
        'SELECT p.module, p.action FROM user_permissions up JOIN permissions p ON up.permissionId = p.id WHERE up.userId = ?',
        [queryUserId]
      );
    }

    const rows = (res?.data ?? []) as PermissionEntry[];
    const keys = new Set(rows.map((r) => `${r.module}:${r.action}`));

    console.log(`[Permissions] Loaded ${keys.size} keys for ${username || cacheKey} (roleId=${roleId})`);

    _cachedKey = cacheKey;
    _cachedPerms = keys;
    return keys;
  } catch (err) {
    console.warn('loadPermissions: query failed:', err);
    return new Set();
  }
}

// ─── Permission checks ───────────────────────────────────────────

/** Check if user has a specific permission */
export function has(perms: Set<string>, module: string, action: string): boolean {
  return perms.has(`${module}:${action}`);
}

/** Check if section is visible */
export function canSection(perms: Set<string>, module: string): boolean {
  return perms.has(`${module}:section.visible`);
}

/** Check if tab is visible */
export function canTab(perms: Set<string>, module: string, tabId: string): boolean {
  return perms.has(`${module}:tab.${tabId}`);
}

/** Check if field is visible */
export function canField(perms: Set<string>, module: string, fieldId: string): boolean {
  return perms.has(`${module}:field.${fieldId}`);
}

/** Check CRUD permission */
export function canView(perms: Set<string>, module: string): boolean {
  return perms.has(`${module}:view`);
}
export function canCreate(perms: Set<string>, module: string): boolean {
  return perms.has(`${module}:create`);
}
export function canEdit(perms: Set<string>, module: string): boolean {
  return perms.has(`${module}:edit`);
}
export function canDelete(perms: Set<string>, module: string): boolean {
  return perms.has(`${module}:delete`);
}
export function canArchive(perms: Set<string>, module: string): boolean {
  return perms.has(`${module}:archive`);
}

/** Check action permission */
export function canAction(perms: Set<string>, module: string, actionId: string): boolean {
  return perms.has(`${module}:action.${actionId}`);
}

// ─── Backward compatibility ──────────────────────────────────────
// These functions maintain the old API so existing components don't break

/** Old-style can() — used by many components */
export function can(permissions: PermissionEntry[] | Set<string>, module: string, action: string): boolean {
  if (permissions instanceof Set) {
    return permissions.has(`${module}:${action}`);
  }
  // Legacy array format
  return permissions.some((p) => p.module === module && p.action === action);
}

/** Old-style canSectionVisible() — used by Sidebar */
export function canSectionVisible(permissions: PermissionEntry[] | Set<string>, module: string): boolean {
  if (permissions instanceof Set) {
    return canSection(permissions, module);
  }
  // Legacy: check section.visible in array
  const hasSectionKey = permissions.some(
    (p) => p.module === module && p.action === 'section.visible'
  );
  if (hasSectionKey) return true;
  // Module doesn't have section.visible concept = always visible
  const SECTION_MODULES = new Set([
    'employees', 'branches', 'housing', 'vehicles', 'employers',
    'phones', 'entities', 'documents', 'settings', 'logs',
  ]);
  return !SECTION_MODULES.has(module);
}

/** Convert Set<string> to PermissionEntry[] for backward compatibility */
export function permsToArray(perms: Set<string>): PermissionEntry[] {
  return [...perms].map((key) => {
    const [module, ...rest] = key.split(':');
    return { module, action: rest.join(':') };
  });
}

// ─── Legacy functions for employee/branch field views ─────────────
// These will be simplified but kept for existing component compatibility

export function canEmployeesFieldView(permissions: PermissionEntry[] | Set<string> | undefined, fieldAction: string): boolean {
  if (permissions == null) return true;
  if (permissions instanceof Set) {
    const mapped = mapLegacyFieldAction('employees', fieldAction);
    return permissions.has(mapped);
  }
  // Array path: also apply mapping (v4 catalog uses simplified names)
  const mapped = mapLegacyFieldAction('employees', fieldAction);
  return permissions.some((p) => `${p.module}:${p.action}` === mapped);
}

export function canBranchesFieldView(permissions: PermissionEntry[] | Set<string> | undefined, fieldAction: string): boolean {
  if (permissions == null) return true;
  if (permissions instanceof Set) {
    const mapped = mapLegacyFieldAction('branches', fieldAction);
    return permissions.has(mapped);
  }
  // Array path: also apply mapping (v4 catalog uses simplified names)
  const mapped = mapLegacyFieldAction('branches', fieldAction);
  return permissions.some((p) => `${p.module}:${p.action}` === mapped);
}

/** Map old verbose field action names to new simplified ones */
function mapLegacyFieldAction(module: string, oldAction: string): string {
  // Employee field mappings (old → new)
  const EMP_MAP: Record<string, string> = {
    'field.salaryTotal.view': 'employees:field.salary',
    'field.salaryComponents.view': 'employees:field.salary',
    'field.salaryComponents.edit': 'employees:field.salary',
    'field.actualSalary.view': 'employees:field.actualSalary',
    'field.contractSalary.view': 'employees:field.salary',
    'field.contractDetails.view': 'employees:field.contractDetails',
    'field.contractDetails.edit': 'employees:field.contractDetails',
    'field.contractAllowances.view': 'employees:field.contractAllowances',
    'field.contractAllowances.edit': 'employees:field.contractAllowances',
    'field.passportNo.view': 'employees:field.passportNo',
    'field.passportIssueDate.view': 'employees:field.passportNo',
    'field.passportExpiry.view': 'employees:field.passportExpiry',
    'field.nationalId.view': 'employees:field.nationalId',
    'field.emiratesIdIssueDate.view': 'employees:field.nationalId',
    'field.emiratesIdExpiry.view': 'employees:field.emiratesIdExpiry',
    'field.residencyEmirate.view': 'employees:field.nationalId',
    'field.residencyEmployer.view': 'employees:field.nationalId',
    'field.immigrationEstablishment.view': 'employees:field.nationalId',
    'field.nationality.view': 'employees:field.nationality',
    'field.email.view': 'employees:field.email',
    'field.phone.view': 'employees:field.phone',
    'field.contractTradeName.view': 'employees:field.contractDetails',
    'field.contractEstablishmentNumber.view': 'employees:field.contractDetails',
    'field.professionContract.view': 'employees:field.profession',
    'field.contractStartDate.view': 'employees:field.contractDetails',
    'field.contractExpiryField.view': 'employees:field.contractDetails',
    'field.healthInsuranceFields.view': 'employees:field.insuranceHealth',
    'field.unemploymentInsuranceFields.view': 'employees:field.insuranceUnemployment',
    'field.workStatusSummary.view': 'employees:field.workBranch',
    'field.workBranchLink.view': 'employees:field.workBranch',
    'field.professionWork.view': 'employees:field.profession',
    'field.secondedLoanDetails.view': 'employees:field.loanDetails',
    'field.profilePhoto.view': 'employees:field.profilePhoto',
    'field.professionDisplay.view': 'employees:field.profession',
    'field.documentsLegal.view': 'employees:field.documentsLegal',
    'field.documentsFinancial.view': 'employees:field.documentsFinancial',
  };

  // Branch field mappings (old → new)
  const BR_MAP: Record<string, string> = {
    'field.branchTypeAndStatus.view': 'branches:field.branchType',
    'field.locationEmirateCity.view': 'branches:field.location',
    'field.branchContact.view': 'branches:field.contact',
    'field.branchPhoto.view': 'branches:field.photo',
    'field.branchAddress.view': 'branches:field.address',
    'field.mapLink.view': 'branches:field.mapLink',
    'field.workSchedule.view': 'branches:field.workSchedule',
    'field.linkedBranch.view': 'branches:field.linkedBranch',
    'field.tradeLicense.view': 'branches:field.tradeLicense',
    'field.leaseContractMeta.view': 'branches:field.leaseContract',
    'field.leaseAmount.view': 'branches:field.leaseAmount',
    'field.leaseTotalContractValue.view': 'branches:field.leaseAmount',
    'field.leasePaymentSchedule.view': 'branches:field.leaseSchedule',
    'field.leaseInstallmentAmounts.view': 'branches:field.leaseSchedule',
    'field.customEstablishmentSections.view': 'branches:field.tradeLicense',
    'field.taxIdentifiers.view': 'branches:field.taxIdentifiers',
    'field.entityInfo.view': 'branches:field.entityInfo',
    'field.establishmentEmployees.view': 'branches:field.employeeList',
    'field.branchEmployeeList.view': 'branches:field.employeeList',
    'field.showSalariesInBranchEmployeeTab.view': 'branches:field.salaryInEmployeeTab',
    'field.employerList.view': 'branches:field.employerList',
    'field.employerOwnership.view': 'branches:field.employerOwnership',
    'field.documentsTradeLicense.view': 'branches:field.tradeLicense',
    'field.documentsLease.view': 'branches:field.leaseContract',
    'field.documentsGeneral.view': 'branches:field.tradeLicense',
    'field.assignedPhonesList.view': 'branches:field.contact',
  };

  const map = module === 'employees' ? EMP_MAP : BR_MAP;
  return map[oldAction] ?? `${module}:${oldAction}`;
}

// ─── Sensitive action checks (backward compat) ───────────────────

export function canEmployeesSensitiveAction(
  permissions: PermissionEntry[] | Set<string>,
  actionKey: 'changeStatus' | 'transferBranch' | 'uploadDocuments' | 'deleteDocuments'
): boolean {
  const map: Record<string, string> = {
    changeStatus: 'action.changeStatus',
    transferBranch: 'action.transferBranch',
    uploadDocuments: 'action.uploadDocs',
    deleteDocuments: 'action.deleteDocs',
  };
  const v4Action = map[actionKey] ?? `action.${actionKey}`;

  if (permissions instanceof Set) {
    return permissions.has(`employees:${v4Action}`);
  }
  // Array path: check with v4 action name
  return permissions.some((p) => p.module === 'employees' && p.action === v4Action);
}

export function canBranchesSensitiveAction(
  permissions: PermissionEntry[] | Set<string>,
  actionKey: 'uploadBranchDocuments' | 'deleteBranchDocuments'
): boolean {
  const map: Record<string, string> = {
    uploadBranchDocuments: 'action.uploadDocs',
    deleteBranchDocuments: 'action.deleteDocs',
  };
  const v4Action = map[actionKey] ?? `action.${actionKey}`;

  if (permissions instanceof Set) {
    return permissions.has(`branches:${v4Action}`);
  }
  // Array path: check with v4 action name
  return permissions.some((p) => p.module === 'branches' && p.action === v4Action);
}

// ─── Cache management ─────────────────────────────────────────────

export function clearPermissionsCache(): void {
  _cachedKey = null;
  _cachedPerms = new Set();
}

// ─── Legacy exports (kept for backward compat) ───────────────────

/** @deprecated Use loadPermissions instead */
export async function getPermissionsForUser(userId: number, roleId: number): Promise<PermissionEntry[]> {
  const perms = await loadPermissions(userId, roleId);
  return permsToArray(perms);
}

/** @deprecated Use loadPermissions instead */
export async function getPermissionsForRole(roleId: number): Promise<PermissionEntry[]> {
  // Admin gets everything, others get empty (user_permissions is per-user now)
  if (roleId === 1) return permsToArray(getAdminKeys());
  return [];
}

// Legacy tab view
export function canTabView(permissions: PermissionEntry[] | Set<string>, module: string, tabAction: string): boolean {
  return can(permissions, module, tabAction);
}
