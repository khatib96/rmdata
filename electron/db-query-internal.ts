/**
 * Shared DB query path for main process: same remote/local routing as ipc `db:query`.
 * Injected from main.ts after remote session helpers are available.
 */
export type DbQueryInternalResult = {
  success: boolean;
  data?: unknown[];
  lastInsertId?: number | null;
  error?: string;
};

let impl: ((query: string, params?: unknown[]) => Promise<DbQueryInternalResult>) | null = null;

export function setDbQueryInternalImpl(fn: NonNullable<typeof impl>): void {
  impl = fn;
}

export async function runDbQueryInternal(query: string, params?: unknown[]): Promise<DbQueryInternalResult> {
  if (!impl) {
    return { success: false, error: 'DB_QUERY_INTERNAL_NOT_INITIALIZED' };
  }
  return impl(query, params);
}
