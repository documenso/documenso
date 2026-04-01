import { useEffect, useMemo, useRef } from 'react';

import Konva from 'konva';

import { type PageRenderData } from '../providers/envelope-render-provider';

type RenderFunction = (props: { stage: Konva.Stage; pageLayer: Konva.Layer }) => void;

export const usePageRenderer = (renderFunction: RenderFunction, pageData: PageRenderData) => {
  const { pageWidth, pageHeight, scale, imageLoadingState, pageNumber } = pageData;

  const konvaContainer = useRef<HTMLDivElement>(null);

  const stage = useRef<Konva.Stage | null>(null);
  const pageLayer = useRef<Konva.Layer | null>(null);

  /**
   * The raw viewport with no scaling. Basically the actual PDF size.
   */
  const unscaledViewport = useMemo(
    () => ({
      scale: 1,
      width: pageWidth,
      height: pageHeight,
    }),
    [pageWidth, pageHeight],
  );

  /**
   * The viewport scaled according to page width.
   */
  const scaledViewport = useMemo(
    () => ({
      scale,
      width: pageWidth * scale,
      height: pageHeight * scale,
    }),
    [pageWidth, pageHeight, scale],
  );

  useEffect(() => {
    const { current: container } = konvaContainer;

    if (!container || imageLoadingState !== 'loaded') {
      return;
    }

    stage.current = new Konva.Stage({
      container,
      id: `page-${pageNumber}`,
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

    return () => {
      stage.current?.destroy();
      stage.current = null;
    };
  }, [imageLoadingState, scaledViewport]);

  return {
    konvaContainer,
    stage,
    pageLayer,
    unscaledViewport,
    scaledViewport,
  };
};
