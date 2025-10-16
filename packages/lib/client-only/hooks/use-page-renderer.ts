import { useEffect, useMemo, useRef } from 'react';

import Konva from 'konva';
import type { RenderParameters } from 'pdfjs-dist/types/src/display/api';
import { usePageContext } from 'react-pdf';

type RenderFunction = (props: { stage: Konva.Stage; pageLayer: Konva.Layer }) => void;

export function usePageRenderer(renderFunction: RenderFunction) {
  const pageContext = usePageContext();

  if (!pageContext) {
    throw new Error('Unable to find Page context.');
  }

  const { page, rotate, scale } = pageContext;

  if (!page) {
    throw new Error('Attempted to render page canvas, but no page was specified.');
  }

  const canvasElement = useRef<HTMLCanvasElement>(null);
  const konvaContainer = useRef<HTMLDivElement>(null);

  const stage = useRef<Konva.Stage | null>(null);
  const pageLayer = useRef<Konva.Layer | null>(null);

  const unscaledViewport = useMemo(
    () => page.getViewport({ scale: 1, rotation: rotate }),
    [page, rotate, scale],
  );

  const scaledViewport = useMemo(
    () => page.getViewport({ scale, rotation: rotate }),
    [page, rotate, scale],
  );

  /**
   * Render the PDF and create the scaled Konva stage.
   */
  useEffect(
    function drawPageOnCanvas() {
      if (!page) {
        return;
      }

      const { current: canvas } = canvasElement;
      const { current: kContainer } = konvaContainer;

      if (!canvas || !kContainer) {
        return;
      }

      const renderContext: RenderParameters = {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        canvasContext: canvas.getContext('2d', { alpha: false }) as CanvasRenderingContext2D,
        viewport: scaledViewport,
      };

      const cancellable = page.render(renderContext);
      const runningTask = cancellable;

      cancellable.promise.catch(() => {
        // Intentionally empty
      });

      void cancellable.promise.then(() => {
        stage.current = new Konva.Stage({
          container: kContainer,
          width: scaledViewport.width,
          height: scaledViewport.height,
          scale: {
            x: scale,
            y: scale,
          },
        });

        // Create the main layer for interactive elements.
        pageLayer.current = new Konva.Layer();

        stage.current.add(pageLayer.current);

        renderFunction({
          stage: stage.current,
          pageLayer: pageLayer.current,
        });
      });

      return () => {
        runningTask.cancel();
      };
    },
    [page, scaledViewport],
  );

  return {
    canvasElement,
    konvaContainer,
    stage,
    pageLayer,
    unscaledViewport,
    scaledViewport,
    pageContext,
  };
}
