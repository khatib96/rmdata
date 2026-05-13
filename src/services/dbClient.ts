import type { QueryResult } from '../types/electron';

export const DEFAULT_STALE_TIME_MS = 30_000;

interface CacheEntry<T> {
  result: QueryResult<T>;
  storedAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();
const inflight = new Map<string, Promise<QueryResult<unknown>>>();

function buildKey(sql: string, params?: unknown[]) {
  return JSON.stringify([sql, params ?? null]);
}

function isSelectQuery(sql: string) {
  return /^\s*(?:with\s+[\s\S]+?\)\s*)?select\b/i.test(sql.trim());
}

/**
 * Clears cached SELECT results. Call after mutations that affect displayed data.
 * @param prefix — if set, only keys whose SQL starts with this substring (trimmed) are removed
 */
export function invalidateDbCache(prefix?: string) {
  if (!prefix) {
    cache.clear();
    return;
  }
  const p = prefix.trim().toLowerCase();
  for (const key of cache.keys()) {
    try {
      const parsed = JSON.parse(key) as [string, unknown];
      const sql = String(parsed[0] ?? '').trim().toLowerCase();
      if (sql.startsWith(p)) cache.delete(key);
    } catch {
      cache.delete(key);
    }
  }
}

export async function dbQuery<T = unknown>(
  sql: string,
  params?: unknown[],
  options?: { skipCache?: boolean; signal?: AbortSignal; staleTimeMs?: number }
): Promise<QueryResult<T> | undefined> {
  if (typeof window === 'undefined') return undefined;
  const api = window.electronAPI;
  if (!api?.dbQuery) return undefined;

  const signal = options?.signal;
  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }

  const useCache = !options?.skipCache && isSelectQuery(sql);
  const staleTime = options?.staleTimeMs ?? DEFAULT_STALE_TIME_MS;
  const key = buildKey(sql, params);

  if (useCache) {
    const hit = cache.get(key) as CacheEntry<T> | undefined;
    if (hit && Date.now() - hit.storedAt < staleTime) {
      return hit.result;
    }
    const pending = inflight.get(key) as Promise<QueryResult<T>> | undefined;
    if (pending) {
      return pending;
    }
  }

  const run = (async () => {
    const onAbort = () => { /* ipc cannot cancel; flag for caller */ };
    if (signal) signal.addEventListener('abort', onAbort, { once: true });
    try {
      const result = (await api.dbQuery(sql, params)) as QueryResult<T>;
      if (useCache && result && !signal?.aborted) {
        cache.set(key, { result: result as QueryResult<unknown>, storedAt: Date.now() });
      }
      return result;
    } finally {
      inflight.delete(key);
      if (signal) signal.removeEventListener('abort', onAbort);
    }
  })();

  if (useCache) {
    inflight.set(key, run as Promise<QueryResult<unknown>>);
  }

  return run;
}
