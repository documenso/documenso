import {
  ENVELOPE_VIEWER_MAX_ZOOM,
  ENVELOPE_VIEWER_MIN_ZOOM,
  useCurrentEnvelopeRender,
} from '@documenso/lib/client-only/providers/envelope-render-provider';
import { cn } from '@documenso/ui/lib/utils';
import { Trans, useLingui } from '@lingui/react/macro';
import { EyeIcon, EyeOffIcon, ZoomInIcon, ZoomOutIcon } from 'lucide-react';
import { useLayoutEffect, useState } from 'react';

import type { ScrollTarget } from '../virtual-list/use-virtual-list';

/**
 * The gap between the toolbar and the bottom of the visible viewer area.
 */
const TOOLBAR_BOTTOM_OFFSET = 24;

export type EnvelopePdfViewerToolbarControl = 'zoom' | 'fields' | 'contents';

export type EnvelopePdfViewerToolbarProps = {
  /**
   * The controls to display in the toolbar.
   */
  controls?: EnvelopePdfViewerToolbarControl[];

  /**
   * The scroll container the toolbar is aligned against.
   *
   * The toolbar is fixed to the viewport, horizontally centered over the
   * scroll container and pinned to the bottom of its visible area.
   */
  scrollParentRef: ScrollTarget;

  className?: string;
};

/**
 * A floating toolbar for the envelope PDF viewer providing zoom and
 * fields/contents visibility controls.
 *
 * Rendered with fixed positioning aligned to the viewer's scroll container,
 * so it can be mounted anywhere within the viewer tree, including inside the
 * scroll container itself.
 */
export const EnvelopePdfViewerToolbar = ({
  controls = ['zoom'],
  scrollParentRef,
  className,
}: EnvelopePdfViewerToolbarProps) => {
  const { t } = useLingui();

  const { viewerControls } = useCurrentEnvelopeRender();

  const {
    zoom,
    setZoom,
    zoomIn,
    zoomOut,
    fieldsVisibility,
    setFieldsVisibility,
    contentsVisibility,
    setContentsVisibility,
  } = viewerControls;

  const [position, setPosition] = useState<{ left: number; bottom: number } | null>(null);

  /**
   * Keep the toolbar aligned with the visible area of the scroll container.
   */
  useLayoutEffect(() => {
    // The toolbar renders inside the scroll container, so the container's ref
    // is not attached yet when this first runs. It is therefore observed as
    // soon as measuring finds it, which also covers it being replaced.
    let observedScrollEl: HTMLElement | null = null;

    function measure() {
      if (scrollParentRef === 'window') {
        setPosition({
          left: window.innerWidth / 2,
          bottom: TOOLBAR_BOTTOM_OFFSET,
        });

        return;
      }

      const scrollEl = scrollParentRef.current;

      if (!scrollEl) {
        setPosition(null);
        return;
      }

      if (observedScrollEl !== scrollEl) {
        if (observedScrollEl) {
          resizeObserver.unobserve(observedScrollEl);
        }

        resizeObserver.observe(scrollEl);
        observedScrollEl = scrollEl;
      }

      const rect = scrollEl.getBoundingClientRect();

      const visibleLeft = Math.max(0, rect.left);
      const visibleRight = Math.min(window.innerWidth, rect.right);
      const visibleBottom = Math.min(window.innerHeight, rect.bottom);

      setPosition({
        left: visibleLeft + (visibleRight - visibleLeft) / 2,
        bottom: window.innerHeight - visibleBottom + TOOLBAR_BOTTOM_OFFSET,
      });
    }

    const resizeObserver = new ResizeObserver(() => measure());

    measure();

    window.addEventListener('resize', measure);

    // Covers viewport and page level layout changes, and delivers an initial
    // notification which picks up the scroll container once it is attached.
    resizeObserver.observe(document.body);

    return () => {
      window.removeEventListener('resize', measure);
      resizeObserver.disconnect();
    };
  }, [scrollParentRef]);

  const showZoom = controls.includes('zoom');
  const showFieldsToggle = controls.includes('fields');
  const showContentsToggle = controls.includes('contents');

  const isFieldsHidden = fieldsVisibility === 'hidden';
  const isContentsHidden = contentsVisibility === 'hidden';

  if (!position) {
    return null;
  }

  return (
    <div
      className={cn(
        'fixed z-40 flex w-fit -translate-x-1/2 items-center gap-x-0.5 rounded-xl bg-popover p-1.5 text-popover-foreground shadow-lg ring-1 ring-black/10 dark:ring-white/10',
        className,
      )}
      style={{
        left: position.left,
        bottom: position.bottom,
      }}
    >
      {showZoom && (
        <>
          <button
            type="button"
            title={t`Zoom out`}
            disabled={zoom <= ENVELOPE_VIEWER_MIN_ZOOM}
            onClick={zoomOut}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
          >
            <ZoomOutIcon className="h-4 w-4" />
          </button>

          <button
            type="button"
            title={t`Reset zoom`}
            onClick={() => setZoom(1)}
            className="min-w-12 rounded-md px-1 py-1.5 text-center text-muted-foreground text-xs tabular-nums transition-colors hover:bg-muted hover:text-foreground"
          >
            {Math.round(zoom * 100)}%
          </button>

          <button
            type="button"
            title={t`Zoom in`}
            disabled={zoom >= ENVELOPE_VIEWER_MAX_ZOOM}
            onClick={zoomIn}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
          >
            <ZoomInIcon className="h-4 w-4" />
          </button>
        </>
      )}

      {showZoom && (showFieldsToggle || showContentsToggle) && <div className="mx-1 h-5 w-px bg-border" />}

      {showFieldsToggle && (
        <button
          type="button"
          title={isFieldsHidden ? t`Show fields` : t`Hide fields`}
          onClick={() => setFieldsVisibility(isFieldsHidden ? 'visible' : 'hidden')}
          className={cn(
            'flex items-center gap-x-1.5 rounded-md px-2 py-1.5 text-muted-foreground text-xs transition-colors hover:bg-muted hover:text-foreground',
            {
              'text-muted-foreground/60': isFieldsHidden,
            },
          )}
        >
          {isFieldsHidden ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
          <Trans>Fields</Trans>
        </button>
      )}

      {showContentsToggle && (
        <button
          type="button"
          title={isContentsHidden ? t`Show contents` : t`Hide contents`}
          onClick={() => setContentsVisibility(isContentsHidden ? 'visible' : 'hidden')}
          className={cn(
            'flex items-center gap-x-1.5 rounded-md px-2 py-1.5 text-muted-foreground text-xs transition-colors hover:bg-muted hover:text-foreground',
            {
              'text-muted-foreground/60': isContentsHidden,
            },
          )}
        >
          {isContentsHidden ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
          <Trans>Contents</Trans>
        </button>
      )}
    </div>
  );
};
