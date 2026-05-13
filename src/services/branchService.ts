import { dbQuery } from './dbClient';

function runDbQuery(query: string, params?: unknown[]) {
  return dbQuery(query, params, { skipCache: true });
}

export function getActiveBranchesForPhoneAssignments() {
  return runDbQuery('SELECT id, name FROM branches WHERE status="active"');
}

export function getActiveLegalEntityBranchOptions() {
  return runDbQuery('SELECT b.id, COALESCE(bl.tradeName, b.name) as name FROM branches b LEFT JOIN branch_licenses bl ON b.id = bl.branchId WHERE b.status="active" ORDER BY name ASC');
}

export function getEmployeeFormBranches() {
  return runDbQuery(
    `SELECT b.id, b.name, b.emirate, (SELECT tradeName FROM branch_licenses WHERE branchId = b.id LIMIT 1) as tradeName
     FROM branches b WHERE (b.status IS NULL OR b.status != 'archived')`
  );
}

export function getEnabledEstablishmentBranchIds() {
  return runDbQuery('SELECT branchId FROM branch_establishments WHERE isEnabled = 1');
}

export function getBranchById(branchId: number) {
  return runDbQuery('SELECT * FROM branches WHERE id = ?', [branchId]);
}

export function getBranchLicense(branchId: number) {
  return runDbQuery('SELECT * FROM branch_licenses WHERE branchId = ? LIMIT 1', [branchId]);
}

export function getBranchLease(branchId: number) {
  return runDbQuery('SELECT * FROM branch_leases WHERE branchId = ? LIMIT 1', [branchId]);
}

export function getBranchLeaseInstallments(branchId: number) {
  return runDbQuery('SELECT * FROM lease_installments WHERE leaseId = (SELECT id FROM branch_leases WHERE branchId = ? LIMIT 1) ORDER BY seq', [branchId]);
}

export function getBranchEstablishment(branchId: number) {
  return runDbQuery('SELECT * FROM branch_establishments WHERE branchId = ? LIMIT 1', [branchId]);
}

export function getBranchCustomFields(branchId: number) {
  return runDbQuery('SELECT * FROM branch_custom_fields WHERE branchId = ?', [branchId]);
}

export function getBranchTaxEntityLink(branchId: number) {
  return runDbQuery('SELECT entityId FROM tax_entity_branches WHERE branchId = ? LIMIT 1', [branchId]);
}

export function getBranchEmployeesForProfile(
  branchId: number,
  activeStatus: string,
  leaveStatus: string,
  secondedStatus: string,
  internalLoanType: string,
  activeLoanSubStatus: string
) {
  return runDbQuery(
    `SELECT id, name, phone, profession, professionPerContract, imagePath, actualSalary, status, loanType, loanSubStatus
     FROM employees WHERE workBranchId = ?
     AND (status IN (?, ?) OR (status = ? AND loanType = ? AND loanSubStatus = ?))`,
    [branchId, activeStatus, leaveStatus, secondedStatus, internalLoanType, activeLoanSubStatus]
  );
}

export function getBranchEstablishmentPrimaryEmployees(branchId: number) {
  return runDbQuery(
    `SELECT id, name, imagePath, contractType, totalSalary, professionPerContract, contractExpiryDate, emiratesIdExpiry, status, loanType, loanSubStatus
     FROM employees WHERE COALESCE(contractBranchId, workBranchId) = ? AND (status IS NULL OR status != 'archived')`,
    [branchId]
  );
}

export function getBranchSecondedEmployees(branchId: number, secondedStatus: string, internalLoanType: string) {
  return runDbQuery(
    `SELECT id, name, imagePath, loanSalary, loanProfession, loanExpiryDate, emiratesIdExpiry, status, loanType, loanSubStatus
     FROM employees WHERE loanBranchId = ? AND status = ? AND loanType = ?`,
    [branchId, secondedStatus, internalLoanType]
  );
}

export function getBranchBasicLocationById(branchId: number) {
  return runDbQuery('SELECT id, name, emirate, city, address FROM branches WHERE id = ?', [branchId]);
}

/** أفرع رئيسية فقط لربط أصحاب العمل — تُستبعد الأفرع المرتبطة بفرع آخر */
export function getMainBranchesForEmployerLink() {
  return runDbQuery(
    `SELECT b.id, b.name, b.code, b.emirate, b.branchType,
     (SELECT tradeName FROM branch_licenses WHERE branchId = b.id LIMIT 1) as tradeName
     FROM branches b
     WHERE (b.status IS NULL OR b.status != 'archived')
     AND b.attachedToId IS NULL
     AND (b.branchType IN ('store', 'workshop', 'office'))
     ORDER BY b.name`
  );
}
