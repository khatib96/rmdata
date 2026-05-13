function runDbQuery(query: string, params?: unknown[]) {
  return window.electronAPI?.dbQuery
    ? window.electronAPI.dbQuery(query, params)
    : Promise.resolve(undefined);
}

/** أصحاب العمل النشطون لتعيين الهواتف (قائمة أفراد) */
export function getAssignableEmployersForPhones() {
  return runDbQuery(
    'SELECT id, fullName as name FROM employers WHERE status = ? ORDER BY fullName',
    ['active']
  );
}
