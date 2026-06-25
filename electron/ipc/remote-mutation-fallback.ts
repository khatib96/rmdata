import { executeRemoteDbQueryOnce } from '../remote-api-utils';

export type SqlRunner = {
  query<T = unknown>(sql: string, params?: unknown[]): Promise<T[]>;
  run(sql: string, params?: unknown[]): Promise<void>;
};

export type ArchiveResourceConfig = {
  table: string;
  entityType: string;
  clearNotificationsOnArchive?: boolean;
};

export type EmployeeStatusPayload = {
  employeeId: number;
  employeeUpdate: Record<string, unknown>;
  statusChanged?: boolean;
  previousStatus?: string | null;
  effectiveDate?: string | null;
  dateCorrection?: { mainDateChanged?: boolean; actionDate?: string | null } | null;
  performedByUserId?: number | null;
  performedByUsername?: string | null;
};

function isMissingTableError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /no such table|doesn't exist|does not exist|ER_NO_SUCH_TABLE/i.test(msg);
}

export function createRemoteSqlRunner(): SqlRunner {
  return {
    async query<T>(sql: string, params?: unknown[]): Promise<T[]> {
      const res = await executeRemoteDbQueryOnce(sql, params);
      if (!res.success) throw new Error(res.error || 'REMOTE_QUERY_FAILED');
      return (Array.isArray(res.data) ? res.data : []) as T[];
    },
    async run(sql: string, params?: unknown[]) {
      const res = await executeRemoteDbQueryOnce(sql, params);
      if (!res.success) throw new Error(res.error || 'REMOTE_QUERY_FAILED');
    },
  };
}

async function runOptional(run: SqlRunner, sql: string, params: unknown[] = []): Promise<void> {
  try {
    await run.run(sql, params);
  } catch (err) {
    if (isMissingTableError(err)) return;
    throw err;
  }
}

async function allOptional(run: SqlRunner, sql: string, params: unknown[] = []): Promise<unknown[]> {
  try {
    return await run.query(sql, params);
  } catch (err) {
    if (isMissingTableError(err)) return [];
    throw err;
  }
}

export async function deletePermanentViaRunner(
  run: SqlRunner,
  resource: string,
  id: number,
  table: string,
): Promise<void> {
  if (resource === 'employees') {
    await runOptional(run, 'DELETE FROM status_history WHERE entityType = ? AND entityId = ?', ['employee', id]);
    await runOptional(run, 'UPDATE vehicles SET responsibleEmployeeId = NULL WHERE responsibleEmployeeId = ?', [id]);
    await runOptional(run, 'DELETE FROM notifications WHERE entityType = ? AND entityId = ?', ['employee', id]);
  } else if (resource === 'branches') {
    await runOptional(run, 'DELETE FROM tax_entity_branches WHERE branchId = ?', [id]);
    await runOptional(run, 'DELETE FROM branch_custom_fields WHERE branchId = ?', [id]);
    await runOptional(run, 'DELETE FROM branch_establishments WHERE branchId = ?', [id]);
    const leases = await allOptional(run, 'SELECT id FROM branch_leases WHERE branchId = ?', [id]) as { id?: number }[];
    for (const lease of leases) {
      if (lease.id != null) await runOptional(run, 'DELETE FROM lease_installments WHERE leaseId = ?', [lease.id]);
    }
    await runOptional(run, 'DELETE FROM branch_leases WHERE branchId = ?', [id]);
    await runOptional(run, 'DELETE FROM branch_licenses WHERE branchId = ?', [id]);
    await runOptional(run, 'UPDATE employees SET workBranchId = NULL WHERE workBranchId = ?', [id]);
    await runOptional(run, 'DELETE FROM notifications WHERE entityType = ? AND entityId = ?', ['branch', id]);
  } else if (resource === 'vehicles') {
    await runOptional(run, 'DELETE FROM vehicle_custom_fields WHERE vehicleId = ?', [id]);
    await runOptional(run, 'DELETE FROM notifications WHERE entityType = ? AND entityId = ?', ['vehicle', id]);
  } else if (resource === 'phones') {
    await runOptional(run, 'DELETE FROM notifications WHERE entityType = ? AND entityId = ?', ['phone', id]);
  } else if (resource === 'housing') {
    await runOptional(run, 'DELETE FROM documents WHERE entityType = ? AND entityId = ?', ['housing', id]);
    await runOptional(run, 'UPDATE phones SET assignedHousingId = NULL WHERE assignedHousingId = ?', [id]);
    await runOptional(run, 'DELETE FROM notifications WHERE entityType = ? AND entityId = ?', ['housing', id]);
    await runOptional(run, 'DELETE FROM housing_installments WHERE housingId = ?', [id]);
    await runOptional(run, 'DELETE FROM housing_occupants WHERE housingUnitId = ?', [id]);
    await runOptional(run, 'DELETE FROM housing_custom_fields WHERE housingUnitId = ?', [id]);
  } else if (resource === 'entities') {
    await runOptional(run, 'DELETE FROM tax_payments WHERE entityId = ?', [id]);
    await runOptional(run, 'DELETE FROM tax_entity_branches WHERE entityId = ?', [id]);
    await runOptional(run, 'DELETE FROM notifications WHERE entityType = ? AND entityId = ?', ['entity', id]);
  } else if (resource === 'employers') {
    await runOptional(run, 'DELETE FROM branch_employers WHERE employerId = ?', [id]);
    await runOptional(run, 'UPDATE phones SET assignedEmployerId = NULL WHERE assignedEmployerId = ?', [id]);
    await runOptional(run, 'DELETE FROM notifications WHERE entityType = ? AND entityId = ?', ['employer', id]);
  }
  await run.run(`DELETE FROM ${table} WHERE id = ?`, [id]);
}

export async function archiveRecordViaRunner(run: SqlRunner, config: ArchiveResourceConfig, id: number): Promise<void> {
  const rows = await run.query<{ id: number }>(`SELECT id FROM ${config.table} WHERE id = ? LIMIT 1`, [id]);
  if (!rows.length) throw new Error('NOT_FOUND');
  await run.run(`UPDATE ${config.table} SET status = 'archived', updatedAt = datetime('now') WHERE id = ?`, [id]);
  if (config.clearNotificationsOnArchive) {
    await runOptional(run, 'DELETE FROM notifications WHERE entityType = ? AND entityId = ?', [config.entityType, id]);
  }
}

export async function restoreRecordViaRunner(run: SqlRunner, config: ArchiveResourceConfig, id: number): Promise<void> {
  const rows = await run.query<{ id: number }>(`SELECT id FROM ${config.table} WHERE id = ? LIMIT 1`, [id]);
  if (!rows.length) throw new Error('NOT_FOUND');
  await run.run(`UPDATE ${config.table} SET status = 'active', updatedAt = datetime('now') WHERE id = ?`, [id]);
}

export async function employeeStatusUpdateViaRunner(
  run: SqlRunner,
  payload: EmployeeStatusPayload,
  actorUserId?: number | null,
): Promise<void> {
  const u = payload.employeeUpdate;
  const employeeId = payload.employeeId;
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

  const dateCorrection = payload.dateCorrection || null;
  if (dateCorrection?.mainDateChanged && dateCorrection.actionDate) {
    const lastRows = await run.query<{ id?: number; startDate?: string; endDate?: string | null }>(
      "SELECT id, startDate, endDate FROM status_history WHERE entityType = 'employee' AND entityId = ? ORDER BY startDate DESC LIMIT 1",
      [employeeId],
    );
    const last = lastRows[0];
    if (last?.id) {
      const endDate = last.endDate ? String(last.endDate).slice(0, 10) : null;
      const durationDays = endDate
        ? Math.round((new Date(endDate).getTime() - new Date(dateCorrection.actionDate).getTime()) / (1000 * 60 * 60 * 24))
        : 0;
      await run.run('UPDATE status_history SET startDate = ?, durationDays = ? WHERE id = ?', [
        dateCorrection.actionDate,
        durationDays,
        last.id,
      ]);
    }
  }

  if (payload.statusChanged) {
    const effectiveDate = String(payload.effectiveDate || '').slice(0, 10);
    if (!effectiveDate) throw new Error('EFFECTIVE_DATE_REQUIRED');
    const actorId = payload.performedByUserId ?? actorUserId ?? null;
    const actorName = payload.performedByUsername ?? null;
    const lastRows = await run.query<{ id?: number; startDate?: string }>(
      "SELECT id, startDate FROM status_history WHERE entityType = 'employee' AND entityId = ? ORDER BY startDate DESC LIMIT 1",
      [employeeId],
    );
    const lastRecord = lastRows[0];
    if (lastRecord?.startDate) {
      const prevStart = String(lastRecord.startDate).slice(0, 10);
      const durationDays = Math.round((new Date(effectiveDate).getTime() - new Date(prevStart).getTime()) / (1000 * 60 * 60 * 24));
      await run.run('UPDATE status_history SET endDate = ?, durationDays = ? WHERE id = ?', [
        effectiveDate,
        durationDays,
        lastRecord.id,
      ]);
    } else if (payload.previousStatus) {
      await run.run(
        `INSERT INTO status_history (entityType, entityId, status, startDate, endDate, durationDays, performedByUserId, performedByUsername)
         VALUES ('employee', ?, ?, ?, ?, 0, ?, ?)`,
        [employeeId, payload.previousStatus, effectiveDate, effectiveDate, actorId, actorName],
      );
    }
    await run.run(
      `INSERT INTO status_history (entityType, entityId, status, startDate, performedByUserId, performedByUsername)
       VALUES ('employee', ?, ?, ?, ?, ?)`,
      [employeeId, String(u.status), effectiveDate, actorId, actorName],
    );
  }

  await run.run(
    `UPDATE employees SET
       status = ?, workBranchId = ?, profession = ?, professionKeys = ?, professionCustomTitle = ?,
       actualSalary = ?, loanType = ?, loanBranchId = ?, loanProfession = ?, loanSubStatus = ?,
       loanExpiryDate = ?, tempContractNumber = ?, loanSalary = ?, targetEntityName = ?,
       loanLeaveStartDate = ?, loanLeaveEndDate = ?, updatedAt = datetime('now')
     WHERE id = ?`,
    [...updateValues, employeeId],
  );
}
