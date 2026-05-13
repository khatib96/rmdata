function runDbQuery(query: string, params?: unknown[]) {
  return window.electronAPI?.dbQuery
    ? window.electronAPI.dbQuery(query, params)
    : Promise.resolve(undefined);
}

export function getActiveHousingForPhoneAssignments() {
  return runDbQuery('SELECT id, name FROM housing_units WHERE status="active"');
}
