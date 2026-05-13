/**
 * Defense-in-depth for renderer-originated SQL: block obvious DB escape / filesystem probes.
 * Values must still use bound parameters (?) — this only filters the query text.
 */
const FORBIDDEN_SQL = /\b(ATTACH|DETACH|VACUUM|REINDEX)\b/i;
const PRAGMA_SQL = /\bPRAGMA\b/i;

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
}
