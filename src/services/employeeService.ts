function runDbQuery(query: string, params?: unknown[]) {
  return window.electronAPI?.dbQuery
    ? window.electronAPI.dbQuery(query, params)
    : Promise.resolve(undefined);
}

export function getAssignableEmployeesForPhones() {
  return runDbQuery('SELECT id, name FROM employees WHERE status NOT IN ("inactive", "visa_cancelled")');
}

export function getDistinctEmployeeNationalities() {
  return runDbQuery(
    `SELECT DISTINCT nationality FROM employees WHERE nationality IS NOT NULL AND nationality != '' ORDER BY nationality`
  );
}

export function getEmployeeStatusHistory(entityId: number) {
  return runDbQuery(
    `SELECT id, status, startDate, endDate, durationDays, performedByUsername, performedByUserCode, performedByUserId, createdAt
     FROM status_history WHERE entityType = 'employee' AND entityId = ? ORDER BY startDate DESC, id DESC LIMIT 100`,
    [entityId]
  );
}
