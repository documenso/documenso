import { cn } from '@documenso/ui/lib/utils';
import type { ReactNode } from 'react';
import { useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router';

export type SettingsLayoutShellProps = {
  sidebar: ReactNode;
  mobileSidebar: ReactNode;
  children: ReactNode;

  /**
   * `wide` suits pages of tables and charts: a narrower sidebar, less padding and a wider
   * content column.
   */
  width?: 'default' | 'wide';

  /**
   * Makes the content pane a size container, so content can fit itself to the visible pane with
   * `cqh` units (`vh` also counts the header and banners above it).
   */
  isSizeContainer?: boolean;
};

/**
 * The sidebar and internally scrolling content pane shared by the settings and admin layouts.
 *
 * Only fills the viewport when its route sets `layoutMode: 'settings'` in its `handle`, which is
 * what makes the parent layouts render a full-height flex column for it to grow into.
 */
export const SettingsLayoutShell = ({
  sidebar,
  mobileSidebar,
  width = 'default',
  isSizeContainer = false,
  children,
}: SettingsLayoutShellProps) => {
  const { key: locationKey, pathname } = useLocation();
  const navigationType = useNavigationType();

  const contentPaneRef = useRef<HTMLElement>(null);

  const scrollPositionsRef = useRef(new Map<string, number>());
  const currentLocationKeyRef = useRef(locationKey);
  const currentPathnameRef = useRef(pathname);

  const widthClassNames = WIDTH_CLASS_NAMES[width];

  useEffect(() => {
    const contentPane = contentPaneRef.current;

    if (!contentPane) {
      return;
    }

    const onScroll = () => {
      scrollPositionsRef.current.set(currentLocationKeyRef.current, contentPane.scrollTop);
    };

    contentPane.addEventListener('scroll', onScroll, { passive: true });

    return () => contentPane.removeEventListener('scroll', onScroll);
  }, []);

  // The pane scrolls instead of the window, so the router's scroll restoration never reaches it.
  // This mirrors it: back/forward returns to the entry's position, a push (e.g. pagination) or a
  // path change starts at the top, and replace updates to the query string (debounced search
  // boxes) stay put. The router doesn't expose `preventScrollReset`, so pushes that set it still
  // reset. A layout effect, so the entry changes before the browser reports the new page's
  // scroll, which would otherwise overwrite the previous entry's saved position.
  useLayoutEffect(() => {
    const contentPane = contentPaneRef.current;

    if (!contentPane || currentLocationKeyRef.current === locationKey) {
      return;
    }

    const isPathChange = currentPathnameRef.current !== pathname;

    currentLocationKeyRef.current = locationKey;
    currentPathnameRef.current = pathname;

    if (navigationType === 'POP') {
      contentPane.scrollTo(0, scrollPositionsRef.current.get(locationKey) ?? 0);
      return;
    }

    if (navigationType === 'PUSH' || isPathChange) {
      contentPane.scrollTo(0, 0);
    }
  }, [locationKey, pathname, navigationType]);

  return (
    <div className="flex flex-col md:min-h-0 md:flex-1 md:flex-row">
      <aside
        className={cn(
          'hover-scrollbar w-full shrink-0 border-b bg-background md:overflow-y-auto md:border-r md:border-b-0',
          widthClassNames.sidebar,
        )}
      >
        <div className="flex h-full flex-col">
          <div className="hidden md:block">{sidebar}</div>
          <div className="md:hidden">{mobileSidebar}</div>
        </div>
      </aside>

      <main
        ref={contentPaneRef}
        className={cn(
          'relative flex-1 px-4 md:overflow-y-auto',
          isSizeContainer && 'md:[container-type:size]',
          widthClassNames.main,
        )}
      >
        <div className={cn('mx-auto w-full py-6 md:py-8', widthClassNames.content)} data-testid="settings-content">
          {children}
        </div>
      </main>
    </div>
  );
};

const WIDTH_CLASS_NAMES = {
  default: {
    sidebar: 'md:w-80',
    main: 'md:px-12 lg:px-16',
    content: 'max-w-3xl',
  },
  wide: {
    sidebar: 'md:w-64',
    main: 'md:px-6 lg:px-8',
    content: 'max-w-5xl',
  },
} as const;
