import { useCallback, useSyncExternalStore } from 'react';

/**
 * Tracks whether the given CSS media query currently matches.
 *
 * Returns `false` on the server since the viewport is unknown until hydration.
 */
export const useMediaQuery = (query: string) => {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const mediaQueryList = window.matchMedia(query);

      mediaQueryList.addEventListener('change', onStoreChange);

      return () => mediaQueryList.removeEventListener('change', onStoreChange);
    },
    [query],
  );

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    // The server snapshot: the viewport is unknown during SSR, so we assume
    // the query does not match rather than throwing. React re-renders with
    // the real value after hydration, so the only cost is a brief first
    // paint with the non-matching variant.
    () => false,
  );
};

/**
 * Whether the viewport is below the Tailwind `md` breakpoint (768px).
 */
export const useIsMobileViewport = () => useMediaQuery('(max-width: 767px)');
