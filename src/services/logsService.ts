function runDbQuery(query: string, params?: unknown[]) {
  return window.electronAPI?.dbQuery
    ? window.electronAPI.dbQuery(query, params)
    : Promise.resolve(undefined);
}

/** Whitelist: entityType → fixed SELECT (no dynamic table/column names). */
const ENTITY_LABEL_SQL: Record<string, string> = {
  employee: 'SELECT id, name as label FROM employees WHERE id IN ',
  branch: 'SELECT id, name as label FROM branches WHERE id IN ',
  vehicle: 'SELECT id, plateNumber as label FROM vehicles WHERE id IN ',
  housing: 'SELECT id, name as label FROM housing_units WHERE id IN ',
  phone: 'SELECT id, phoneNumber as label FROM phones WHERE id IN ',
  entity: 'SELECT id, name as label FROM entities WHERE id IN ',
  employer: 'SELECT id, fullName as label FROM employers WHERE id IN ',
};

export function getRecentActivityLogs(limit = 1000) {
  const n = Math.floor(Number(limit));
  const capped = Number.isFinite(n) ? Math.min(Math.max(n, 1), 5000) : 1000;
  return runDbQuery(
    `SELECT id, createdAt, module, action, entityType, entityId, details, performedByUsername, performedByUserCode, performedByUserId
     FROM activity_logs
     ORDER BY createdAt DESC
     LIMIT ?`,
    [capped]
  );
}

export function getEntityLabelsByIds(entityType: string, ids: number[]) {
  const safeIds = ids.filter((id) => typeof id === 'number' && Number.isInteger(id));
  if (safeIds.length === 0) return Promise.resolve(undefined);
  const prefix = ENTITY_LABEL_SQL[entityType];
  if (!prefix) return Promise.resolve(undefined);
  const placeholders = safeIds.map(() => '?').join(', ');
  return runDbQuery(`${prefix}(${placeholders})`, safeIds);
}

export function getEntityActivityLogs(entityType: string, entityId: number) {
  return runDbQuery(
    `SELECT id, createdAt, module, action, details, performedByUsername, performedByUserCode, performedByUserId
     FROM activity_logs
     WHERE entityType = ? AND entityId = ?
     ORDER BY createdAt DESC LIMIT 100`,
    [entityType, entityId]
  );
}
