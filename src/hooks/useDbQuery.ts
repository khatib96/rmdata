import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { dbQuery, DEFAULT_STALE_TIME_MS, invalidateDbCache } from '../services/dbClient';
import type { QueryResult } from '../types/electron';

export type UseDbQueryStatus = 'idle' | 'loading' | 'success' | 'error';

export interface UseDbQueryOptions<T> {
  enabled?: boolean;
  staleTimeMs?: number;
  skipCache?: boolean;
  /** Map raw rows before exposing as `data` */
  select?: (result: QueryResult<T> | undefined) => T[] | undefined;
}

export interface UseDbQueryResult<T> {
  data: T[] | undefined;
  raw: QueryResult<T> | undefined;
  status: UseDbQueryStatus;
  error: Error | null;
  isLoading: boolean;
  refetch: () => Promise<void>;
}

/**
 * Unified data fetch with in-memory caching (SELECT only), abort on dependency change,
 * and consistent loading / error state.
 */
export function useDbQuery<T = Record<string, unknown>>(
  query: string | null | undefined,
  params?: unknown[] | null,
  options?: UseDbQueryOptions<T>
): UseDbQueryResult<T> {
  const enabled = options?.enabled !== false && !!query?.trim();
  const staleTimeMs = options?.staleTimeMs ?? DEFAULT_STALE_TIME_MS;
  const skipCache = options?.skipCache;
  const selectRef = useRef(options?.select);
  selectRef.current = options?.select;
  const paramsKey = useMemo(() => JSON.stringify(params ?? null), [params]);

  const [data, setData] = useState<T[] | undefined>(undefined);
  const [raw, setRaw] = useState<QueryResult<T> | undefined>(undefined);
  const [status, setStatus] = useState<UseDbQueryStatus>('idle');
  const [error, setError] = useState<Error | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async () => {
    if (!query?.trim()) {
      setData(undefined);
      setRaw(undefined);
      setStatus('idle');
      setError(null);
      return;
    }

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setStatus('loading');
    setError(null);

    try {
      const result = await dbQuery<T>(query, params ?? undefined, {
        signal: ac.signal,
        staleTimeMs,
        skipCache,
      });

      if (ac.signal.aborted) return;

      setRaw(result);
      const sel = selectRef.current;
      const rows = sel ? sel(result) : (result?.data as T[] | undefined);
      setData(Array.isArray(rows) ? rows : undefined);
      setStatus('success');
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return;
      const err = e instanceof Error ? e : new Error(String(e));
      setError(err);
      setStatus('error');
      setData(undefined);
      setRaw(undefined);
    }
  }, [query, paramsKey, staleTimeMs, skipCache]);

  useEffect(() => {
    if (!enabled) {
      setStatus('idle');
      setData(undefined);
      setRaw(undefined);
      return;
    }
    fetchData();
    return () => {
      abortRef.current?.abort();
    };
  }, [enabled, fetchData]);

  return {
    data,
    raw,
    status,
    error,
    isLoading: status === 'loading',
    refetch: fetchData,
  };
}

export { invalidateDbCache };
