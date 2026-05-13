/**
 * Automated professional numbering: RMB (branches), RME (employees), RMV (vehicles).
 * Format: PREFIX + 4 digits (e.g. RMB0001, RME0002, RMV0001).
 * Unique and permanent per entity.
 */

const PREFIX_BRANCH = 'RMB';
const PREFIX_EMPLOYEE = 'RME';
const PREFIX_VEHICLE = 'RMV';
const PREFIX_HOUSING = 'RMH';
const PREFIX_PHONE = 'RMP';

function parseCodeNumber(code: string, prefix: string): number {
  if (!code || typeof code !== 'string') return 0;
  const trimmed = code.trim();
  if (!trimmed.startsWith(prefix)) return 0;
  const numPart = trimmed.slice(prefix.length);
  const n = parseInt(numPart, 10);
  return Number.isNaN(n) ? 0 : n;
}

/**
 * Generate next code for the given prefix.
 * Fetches last assigned via dbQuery and increments.
 */
export async function generateNextCode(
  prefix: 'RMB' | 'RME' | 'RMV' | 'RMH' | 'RMP',
  table: 'branches' | 'employees' | 'vehicles' | 'housing_units' | 'phones',
  dbQuery: (sql: string, params?: unknown[]) => Promise<{ success?: boolean; data?: { code?: string }[] }>
): Promise<string> {
  const col = 'code';
  const res = await dbQuery(
    `SELECT ${col} FROM ${table} WHERE ${col} IS NOT NULL AND ${col} LIKE ? ORDER BY id DESC LIMIT 1`,
    [`${prefix}%`]
  ).catch(() => ({ data: [] }));
  const rows = res?.data ?? [];
  let maxNum = 0;
  for (const row of rows) {
    const n = parseCodeNumber(row?.code ?? '', prefix);
    if (n > maxNum) maxNum = n;
  }
  const nextNum = maxNum + 1;
  return prefix + String(nextNum).padStart(4, '0');
}

export { PREFIX_BRANCH, PREFIX_EMPLOYEE, PREFIX_VEHICLE, PREFIX_HOUSING, PREFIX_PHONE };
