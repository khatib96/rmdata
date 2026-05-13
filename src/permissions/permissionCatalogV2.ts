/**
 * SSOT permission catalog — every module with its tabs, fields, and actions.
 * Must match server/permissions-catalog.js.
 * Used by Electron migrations to INSERT OR IGNORE into SQLite `permissions`.
 */

// ─── Module definitions ───────────────────────────────────────────
export interface PermissionDef {
  module: string;
  action: string;
}

// ─── Employees ────────────────────────────────────────────────────
export const EMPLOYEES_PERMISSIONS: PermissionDef[] = [
  // Section
  { module: 'employees', action: 'section.visible' },
  { module: 'employees', action: 'view' },
  { module: 'employees', action: 'create' },
  { module: 'employees', action: 'edit' },
  { module: 'employees', action: 'delete' },
  { module: 'employees', action: 'archive' },
  // Tabs
  { module: 'employees', action: 'tab.basic' },
  { module: 'employees', action: 'tab.passport' },
  { module: 'employees', action: 'tab.contract' },
  { module: 'employees', action: 'tab.residency' },
  { module: 'employees', action: 'tab.insurances' },
  { module: 'employees', action: 'tab.workStatus' },
  { module: 'employees', action: 'tab.phones' },
  { module: 'employees', action: 'tab.history' },
  { module: 'employees', action: 'tab.documents' },
  // Fields
  { module: 'employees', action: 'field.nationality' },
  { module: 'employees', action: 'field.email' },
  { module: 'employees', action: 'field.phone' },
  { module: 'employees', action: 'field.profilePhoto' },
  { module: 'employees', action: 'field.passportNo' },
  { module: 'employees', action: 'field.passportExpiry' },
  { module: 'employees', action: 'field.nationalId' },
  { module: 'employees', action: 'field.emiratesIdExpiry' },
  { module: 'employees', action: 'field.salary' },
  { module: 'employees', action: 'field.actualSalary' },
  { module: 'employees', action: 'field.contractDetails' },
  { module: 'employees', action: 'field.contractAllowances' },
  { module: 'employees', action: 'field.insuranceHealth' },
  { module: 'employees', action: 'field.insuranceUnemployment' },
  { module: 'employees', action: 'field.workBranch' },
  { module: 'employees', action: 'field.profession' },
  { module: 'employees', action: 'field.loanDetails' },
  { module: 'employees', action: 'field.documentsLegal' },
  { module: 'employees', action: 'field.documentsFinancial' },
  // Actions
  { module: 'employees', action: 'action.changeStatus' },
  { module: 'employees', action: 'action.transferBranch' },
  { module: 'employees', action: 'action.uploadDocs' },
  { module: 'employees', action: 'action.deleteDocs' },
  { module: 'employees', action: 'action.exportData' },
];

// ─── Branches ─────────────────────────────────────────────────────
export const BRANCHES_PERMISSIONS: PermissionDef[] = [
  // Section
  { module: 'branches', action: 'section.visible' },
  { module: 'branches', action: 'view' },
  { module: 'branches', action: 'create' },
  { module: 'branches', action: 'edit' },
  { module: 'branches', action: 'delete' },
  // Tabs
  { module: 'branches', action: 'tab.basic' },
  { module: 'branches', action: 'tab.licenses' },
  { module: 'branches', action: 'tab.entity' },
  { module: 'branches', action: 'tab.employees' },
  { module: 'branches', action: 'tab.employers' },
  { module: 'branches', action: 'tab.history' },
  { module: 'branches', action: 'tab.documents' },
  { module: 'branches', action: 'tab.phones' },
  // Fields
  { module: 'branches', action: 'field.branchType' },
  { module: 'branches', action: 'field.location' },
  { module: 'branches', action: 'field.contact' },
  { module: 'branches', action: 'field.photo' },
  { module: 'branches', action: 'field.address' },
  { module: 'branches', action: 'field.mapLink' },
  { module: 'branches', action: 'field.workSchedule' },
  { module: 'branches', action: 'field.linkedBranch' },
  { module: 'branches', action: 'field.tradeLicense' },
  { module: 'branches', action: 'field.leaseContract' },
  { module: 'branches', action: 'field.leaseAmount' },
  { module: 'branches', action: 'field.leaseSchedule' },
  { module: 'branches', action: 'field.taxIdentifiers' },
  { module: 'branches', action: 'field.entityInfo' },
  { module: 'branches', action: 'field.employeeList' },
  { module: 'branches', action: 'field.salaryInEmployeeTab' },
  { module: 'branches', action: 'field.employerList' },
  { module: 'branches', action: 'field.employerOwnership' },
  // Actions
  { module: 'branches', action: 'action.uploadDocs' },
  { module: 'branches', action: 'action.deleteDocs' },
];

// ─── Housing ──────────────────────────────────────────────────────
export const HOUSING_PERMISSIONS: PermissionDef[] = [
  { module: 'housing', action: 'section.visible' },
  { module: 'housing', action: 'view' },
  { module: 'housing', action: 'create' },
  { module: 'housing', action: 'edit' },
  { module: 'housing', action: 'delete' },
  // Tabs
  { module: 'housing', action: 'tab.basic' },
  { module: 'housing', action: 'tab.contract' },
  { module: 'housing', action: 'tab.occupants' },
  { module: 'housing', action: 'tab.phones' },
  { module: 'housing', action: 'tab.history' },
  { module: 'housing', action: 'tab.documents' },
  // Fields
  { module: 'housing', action: 'field.contractAmount' },
  { module: 'housing', action: 'field.installments' },
  { module: 'housing', action: 'field.occupantsList' },
  // Actions
  { module: 'housing', action: 'action.uploadDocs' },
  { module: 'housing', action: 'action.deleteDocs' },
];

// ─── Vehicles ─────────────────────────────────────────────────────
export const VEHICLES_PERMISSIONS: PermissionDef[] = [
  { module: 'vehicles', action: 'section.visible' },
  { module: 'vehicles', action: 'view' },
  { module: 'vehicles', action: 'create' },
  { module: 'vehicles', action: 'edit' },
  { module: 'vehicles', action: 'delete' },
  // Tabs
  { module: 'vehicles', action: 'tab.basic' },
  { module: 'vehicles', action: 'tab.licenses' },
  { module: 'vehicles', action: 'tab.permits' },
  { module: 'vehicles', action: 'tab.history' },
  { module: 'vehicles', action: 'tab.documents' },
  // Fields
  { module: 'vehicles', action: 'field.insuranceDetails' },
  { module: 'vehicles', action: 'field.licenseDetails' },
  { module: 'vehicles', action: 'field.permitDetails' },
  // Actions
  { module: 'vehicles', action: 'action.uploadDocs' },
  { module: 'vehicles', action: 'action.deleteDocs' },
];

// ─── Employers ────────────────────────────────────────────────────
export const EMPLOYERS_PERMISSIONS: PermissionDef[] = [
  { module: 'employers', action: 'section.visible' },
  { module: 'employers', action: 'view' },
  { module: 'employers', action: 'create' },
  { module: 'employers', action: 'edit' },
  { module: 'employers', action: 'delete' },
  // Tabs
  { module: 'employers', action: 'tab.basic' },
  { module: 'employers', action: 'tab.passportResidency' },
  { module: 'employers', action: 'tab.branches' },
  { module: 'employers', action: 'tab.docs' },
  { module: 'employers', action: 'tab.history' },
  // Fields
  { module: 'employers', action: 'field.passportDetails' },
  { module: 'employers', action: 'field.emiratesId' },
  { module: 'employers', action: 'field.branchLinks' },
  { module: 'employers', action: 'field.ownershipPercent' },
  // Actions
  { module: 'employers', action: 'action.uploadDocs' },
  { module: 'employers', action: 'action.deleteDocs' },
];

// ─── Phones ───────────────────────────────────────────────────────
export const PHONES_PERMISSIONS: PermissionDef[] = [
  { module: 'phones', action: 'section.visible' },
  { module: 'phones', action: 'view' },
  { module: 'phones', action: 'create' },
  { module: 'phones', action: 'edit' },
  { module: 'phones', action: 'delete' },
  // Tabs
  { module: 'phones', action: 'tab.basic' },
  { module: 'phones', action: 'tab.history' },
  { module: 'phones', action: 'tab.documents' },
  // Fields
  { module: 'phones', action: 'field.simDetails' },
  { module: 'phones', action: 'field.assignedTo' },
  // Actions
  { module: 'phones', action: 'action.uploadDocs' },
  { module: 'phones', action: 'action.deleteDocs' },
];

// ─── Entities (Tax) ───────────────────────────────────────────────
export const ENTITIES_PERMISSIONS: PermissionDef[] = [
  { module: 'entities', action: 'section.visible' },
  { module: 'entities', action: 'view' },
  { module: 'entities', action: 'create' },
  { module: 'entities', action: 'edit' },
  { module: 'entities', action: 'delete' },
  // Tabs
  { module: 'entities', action: 'tab.main' },
  { module: 'entities', action: 'tab.branches' },
  { module: 'entities', action: 'tab.vat' },
  { module: 'entities', action: 'tab.corporate' },
  { module: 'entities', action: 'tab.summary' },
  { module: 'entities', action: 'tab.documents' },
  { module: 'entities', action: 'tab.history' },
  // Fields
  { module: 'entities', action: 'field.financialYear' },
  { module: 'entities', action: 'field.taxPayments' },
  { module: 'entities', action: 'field.taxSummary' },
  // Actions
  { module: 'entities', action: 'action.uploadDocs' },
  { module: 'entities', action: 'action.deleteDocs' },
];

// ─── Documents ────────────────────────────────────────────────────
export const DOCUMENTS_PERMISSIONS: PermissionDef[] = [
  { module: 'documents', action: 'section.visible' },
  { module: 'documents', action: 'view' },
  { module: 'documents', action: 'create' },
  { module: 'documents', action: 'edit' },
  { module: 'documents', action: 'delete' },
];

// ─── Settings ─────────────────────────────────────────────────────
export const SETTINGS_PERMISSIONS: PermissionDef[] = [
  { module: 'settings', action: 'section.visible' },
  { module: 'settings', action: 'view' },
  { module: 'settings', action: 'edit' },
  // Sub-sections
  { module: 'settings', action: 'sub.general' },
  { module: 'settings', action: 'sub.language' },
  { module: 'settings', action: 'sub.users' },
  { module: 'settings', action: 'sub.permissions' },
  { module: 'settings', action: 'sub.notifications' },
  { module: 'settings', action: 'sub.database' },
  { module: 'settings', action: 'sub.devices' },
  { module: 'settings', action: 'sub.backup' },
  // User management
  { module: 'settings', action: 'users.view' },
  { module: 'settings', action: 'users.create' },
  { module: 'settings', action: 'users.edit' },
  { module: 'settings', action: 'users.delete' },
];

// ─── Logs ─────────────────────────────────────────────────────────
export const LOGS_PERMISSIONS: PermissionDef[] = [
  { module: 'logs', action: 'section.visible' },
  { module: 'logs', action: 'view' },
];

// ─── Full catalog ─────────────────────────────────────────────────
export const PERMISSION_CATALOG_V2: PermissionDef[] = [
  ...EMPLOYEES_PERMISSIONS,
  ...BRANCHES_PERMISSIONS,
  ...HOUSING_PERMISSIONS,
  ...VEHICLES_PERMISSIONS,
  ...EMPLOYERS_PERMISSIONS,
  ...PHONES_PERMISSIONS,
  ...ENTITIES_PERMISSIONS,
  ...DOCUMENTS_PERMISSIONS,
  ...SETTINGS_PERMISSIONS,
  ...LOGS_PERMISSIONS,
];

/** All unique modules in the catalog */
export const ALL_MODULES = [...new Set(PERMISSION_CATALOG_V2.map((p) => p.module))];

/** Get all permission keys as Set<string> for admin */
export function getAllPermissionKeys(): Set<string> {
  return new Set(PERMISSION_CATALOG_V2.map((p) => `${p.module}:${p.action}`));
}
