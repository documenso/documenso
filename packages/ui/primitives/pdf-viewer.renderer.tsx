import { useEffect, useMemo, useRef } from 'react';

import type { RenderParameters } from 'pdfjs-dist/types/src/display/api.js';
import { usePageContext } from 'react-pdf';
import invariant from 'tiny-invariant';

export default function PDFViewerRenderer() {
  const pageContext = usePageContext();

  invariant(pageContext, 'Unable to find Page context.');

  const { _className, page, rotate, scale } = pageContext;

  invariant(page, 'Attempted to render page canvas, but no page was specified.');

  const canvasElement = useRef<HTMLCanvasElement>(null);

  const viewport = useMemo(
    () => page.getViewport({ scale, rotation: rotate }),
    [page, rotate, scale],
  );

  useEffect(() => {
    if (!page) {
      return;
    }

    const { current: canvas } = canvasElement;

    if (!canvas) {
      return;
    }

    const canvasContext = canvas.getContext('2d', { alpha: false });

    if (!canvasContext) {
      return;
    }

    const renderContext: RenderParameters = {
      canvas,
      canvasContext,
      viewport,
    };

    const cancellable = page.render(renderContext);
    const runningTask = cancellable;

    cancellable.promise.catch(() => {
      // Intentionally empty
    });

    return () => {
      runningTask.cancel();
    };
  }, [page, viewport]);

  return (
    <canvas
      ref={canvasElement}
      className={`${_className}__canvas`}
      height={viewport.height}
      width={viewport.width}
    />
  );
}
