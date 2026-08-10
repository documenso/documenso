import { useMatches } from 'react-router';

/**
 * The layout treatment a route wants from its parent layout(s).
 *
 * - `'settings'` — the full-height unified settings layout: no centered page
 *   container, a full-width app header, and a viewport-height flex column so the
 *   settings shell can fill the available space and scroll internally.
 * - `null` — the default layout (centered `<PageContainer />`, normal flow).
 */
export type LayoutMode = 'settings' | null;

/**
 * Typed route `handle` export. Controls layout rendering.
 *
 * - `hideAppHeader` — tells the parent layout to skip rendering `<AppHeader />`.
 * - `layoutMode` — selects the layout treatment the parent layout(s) apply. See
 *   {@link LayoutMode}.
 */
export type RouteHandle = {
  hideAppHeader?: boolean;
  layoutMode?: LayoutMode;
};

/**
 * Returns layout flags from the deepest matching route that sets any.
 * Layouts call this to decide whether to render certain elements.
 */
export function useChildRouteFlags(): { hideAppHeader: boolean; layoutMode: LayoutMode } {
  const matches = useMatches();

  let hideAppHeader = false;
  let layoutMode: LayoutMode = null;

  // Walk from deepest match backward so the leaf route wins per flag.
  for (let i = matches.length - 1; i >= 0; i--) {
    const handle = matches[i].handle;

    if (handle == null || typeof handle !== 'object') {
      continue;
    }

    const h = handle as RouteHandle;

    if (layoutMode === null && h.layoutMode) {
      layoutMode = h.layoutMode;
    }

    if (!hideAppHeader && h.hideAppHeader) {
      hideAppHeader = true;
    }
  }

  return { hideAppHeader, layoutMode };
}
