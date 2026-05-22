/**
 * Defense-in-depth for renderer-originated SQL: block obvious DB escape / filesystem probes.
 * Values must still use bound parameters (?) — this only filters the query text.
 */
const FORBIDDEN_SQL = /\b(ATTACH|DETACH|VACUUM|REINDEX)\b/i;
const PRAGMA_SQL = /\bPRAGMA\b/i;

const LEGACY_MUTATION_TABLE_ALLOWLIST = new Set([
  'activity_logs',
  'branch_custom_fields',
  'branch_employers',
  'branch_establishments',
  'branch_leases',
  'branch_licenses',
  'branches',
  'connected_devices',
  'documents',
  'employee_status_history',
  'employees',
  'employers',
  'entities',
  'housing_custom_fields',
  'housing_installments',
  'housing_occupants',
  'housing_units',
  'lease_installments',
  'notifications',
  'permissions',
  'phones',
  'role_permissions',
  'settings',
  'status_history',
  'user_permission_overrides',
  'user_permissions',
  'users',
  'vehicle_custom_fields',
  'vehicles',
]);

export type DbQuerySqlOperation = 'SELECT' | 'WITH' | 'INSERT' | 'UPDATE' | 'DELETE' | 'REPLACE' | 'OTHER';

export interface DbQueryInspection {
  operation: DbQuerySqlOperation;
  table: string | null;
  isMutation: boolean;
}

function normalizeSqlForInspection(query: string): string {
  return String(query || '')
    .trim()
    .replace(/`([^`]+)`/g, '$1')
    .replace(/"([^"]+)"/g, '$1');
}

function getOperation(query: string): DbQuerySqlOperation {
  const first = normalizeSqlForInspection(query).split(/\s+/, 1)[0]?.toUpperCase();
  if (
    first === 'SELECT' ||
    first === 'WITH' ||
    first === 'INSERT' ||
    first === 'UPDATE' ||
    first === 'DELETE' ||
    first === 'REPLACE'
  ) {
    return first;
  }
  return 'OTHER';
}

function extractMutationTable(query: string, operation: DbQuerySqlOperation): string | null {
  const raw = normalizeSqlForInspection(query);
  let match: RegExpExecArray | null = null;
  if (operation === 'INSERT' || operation === 'REPLACE') {
    match = /\bINTO\s+([A-Za-z0-9_]+)/i.exec(raw);
  } else if (operation === 'UPDATE') {
    match = /\bUPDATE\s+([A-Za-z0-9_]+)/i.exec(raw);
  } else if (operation === 'DELETE') {
    match = /\bFROM\s+([A-Za-z0-9_]+)/i.exec(raw);
  }
  return match ? match[1].toLowerCase() : null;
}

export function inspectDbQuery(query: string): DbQueryInspection {
  const operation = getOperation(query);
  const isMutation = operation === 'INSERT' || operation === 'UPDATE' || operation === 'DELETE' || operation === 'REPLACE';
  return {
    operation,
    table: isMutation ? extractMutationTable(query, operation) : null,
    isMutation,
  };
}

export function assertDbQueryAllowed(query: string): void {
  const q = String(query ?? '').trim();
  if (!q) {
    throw new Error('Empty query');
  }
  if (FORBIDDEN_SQL.test(q)) {
    throw new Error('This SQL operation is not allowed');
  }
  if (PRAGMA_SQL.test(q)) {
    throw new Error('PRAGMA is not allowed');
  }
  const inspected = inspectDbQuery(q);
  if (inspected.operation === 'OTHER') {
    throw new Error('Only SELECT/WITH and legacy allowlisted mutations are allowed');
  }
  if (!inspected.isMutation) return;
  if (!inspected.table || !LEGACY_MUTATION_TABLE_ALLOWLIST.has(inspected.table)) {
    throw new Error(`Mutation through dbQuery is not allowed for table "${inspected.table || 'unknown'}"`);
  }
}
