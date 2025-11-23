import { useEffect, useMemo, useRef, useState } from 'react';

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

  const [renderError, setRenderError] = useState<boolean>(false);

  /**
   * The raw viewport with no scaling. Basically the actual PDF size.
   */
  const unscaledViewport = useMemo(
    () => page.getViewport({ scale: 1, rotation: rotate }),
    [page, rotate, scale],
  );

  /**
   * The viewport scaled according to page width.
   */
  const scaledViewport = useMemo(
    () => page.getViewport({ scale, rotation: rotate }),
    [page, rotate, scale],
  );

  /**
   * Viewport with the device pixel ratio applied so we can render the PDF
   * in a higher resolution.
   */
  const renderViewport = useMemo(
    () => page.getViewport({ scale: scale * window.devicePixelRatio, rotation: rotate }),
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

      canvas.width = renderViewport.width;
      canvas.height = renderViewport.height;

      canvas.style.width = `${Math.floor(scaledViewport.width)}px`;
      canvas.style.height = `${Math.floor(scaledViewport.height)}px`;

      const renderContext: RenderParameters = {
        canvas,
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        canvasContext: canvas.getContext('2d', { alpha: false }) as CanvasRenderingContext2D,
        viewport: renderViewport,
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

        void document.fonts.ready.then(function () {
          pageLayer.current?.batchDraw();
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
    renderError,
    setRenderError,
  };
}
