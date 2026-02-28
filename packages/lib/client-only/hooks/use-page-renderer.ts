import { useEffect, useMemo, useRef, useState } from 'react';

import Konva from 'konva';

import { PDF_VIEWER_PAGE_CLASSNAME } from '@documenso/lib/constants/pdf-viewer';

import { EAGER_LOAD_PAGE_COUNT, type PageRenderData } from '../providers/envelope-render-provider';

type RenderFunction = (props: { stage: Konva.Stage; pageLayer: Konva.Layer }) => void;

export const usePageRenderer = (renderFunction: RenderFunction, pageData: PageRenderData) => {
  const { pageWidth, pageHeight, scale, imageUrl, pageNumber } = pageData;

  const konvaContainer = useRef<HTMLDivElement>(null);

  const stage = useRef<Konva.Stage | null>(null);
  const pageLayer = useRef<Konva.Layer | null>(null);

  const [renderStatus, setRenderStatus] = useState<'loading' | 'loaded' | 'error'>('loading');

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

  /**
   * Viewport with the device pixel ratio applied so we can render the PDF
   * in a higher resolution.
   */
  const renderViewport = useMemo(
    () => ({
      scale: scale * window.devicePixelRatio,
      width: pageWidth * scale * window.devicePixelRatio,
      height: pageHeight * scale * window.devicePixelRatio,
    }),
    [pageWidth, pageHeight, scale],
  );

  /**
   * The props for the image element which will render the page.
   */
  const imageProps = useMemo(
    (): React.ImgHTMLAttributes<HTMLImageElement> & Record<string, unknown> & { alt: '' } => ({
      className: PDF_VIEWER_PAGE_CLASSNAME,
      width: Math.floor(scaledViewport.width),
      height: Math.floor(scaledViewport.height),
      alt: '',
      onLoad: () => setRenderStatus('loaded'),
      // Purposely not using lazy here since we can use the virtual list overscan to let us prerender images.
      loading: pageNumber < EAGER_LOAD_PAGE_COUNT ? 'eager' : undefined,
      src: imageUrl,
      'data-page-number': pageNumber,
    }),
    [renderViewport, scaledViewport, imageUrl],
  );

  useEffect(() => {
    const { current: container } = konvaContainer;

    if (renderStatus !== 'loaded' || !container) {
      return;
    }

    stage.current = new Konva.Stage({
      container,
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
  }, [renderStatus, imageProps]);

  return {
    konvaContainer,
    imageProps,
    stage,
    pageLayer,
    unscaledViewport,
    scaledViewport,
    renderStatus,
    setRenderStatus,
  };
};
