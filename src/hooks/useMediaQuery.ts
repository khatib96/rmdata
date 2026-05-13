import { useState, useEffect } from 'react';

/**
 * Match viewport against a media query. Uses 1024px as mobile breakpoint when (max-width: 1023px).
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    const m = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    setMatches(m.matches);
    m.addEventListener('change', handler);
    return () => m.removeEventListener('change', handler);
  }, [query]);

  return matches;
}

/** True when viewport is < 1024px (mobile layout: bottom nav + mobile header). */
export function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 1023px)');
}
