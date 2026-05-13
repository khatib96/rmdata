import { useEffect, useState } from 'react';
import type { ViewMode } from '../components/shared/ViewModeToggle';

const FALLBACK_DEFAULT: ViewMode = 'grid';

export function usePersistedViewMode(storageKey: string, defaultMode: ViewMode = FALLBACK_DEFAULT) {
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    try {
      const v = localStorage.getItem(storageKey) as ViewMode | null;
      return v === 'grid' || v === 'list' ? v : defaultMode;
    } catch {
      return defaultMode;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, viewMode);
    } catch {
      /* ignore */
    }
  }, [storageKey, viewMode]);

  return [viewMode, setViewMode] as const;
}
