import Konva from 'konva';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { EnvelopePageItemsVisibility } from '../../types/envelope-page-items-visibility';
import { resolvePageItemsVisibility } from '../../types/envelope-page-items-visibility';
import { areContentImagesReady, hasFailedContentImage } from '../../universal/content-renderer/content-image-status';
import { createPageItemsVisibilityApplier } from '../../universal/konva/page-items-visibility';
import type { PageRenderData } from '../providers/envelope-render-provider';
import { useCurrentEnvelopeRender } from '../providers/envelope-render-provider';

type RenderFunction = (props: { stage: Konva.Stage; pageLayer: Konva.Layer }) => void;

type UsePageRendererOptions = {
  fieldsVisibility?: EnvelopePageItemsVisibility;

  contentsVisibility?: EnvelopePageItemsVisibility;
};

export const usePageRenderer = (
  renderFunction: RenderFunction,
  pageData: PageRenderData,
  options: UsePageRendererOptions = {},
) => {
  const { pageWidth, pageHeight, scale, imageLoadingState, pageNumber, onReadyChange } = pageData;

  const { viewerControls, contents, contentImages, currentEnvelopeItem, pageSizes } = useCurrentEnvelopeRender();

  const konvaContainer = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (currentEnvelopeItem) {
      pageSizes.register(currentEnvelopeItem.id, pageNumber, { width: pageWidth, height: pageHeight });
    }
  }, [currentEnvelopeItem?.id, pageNumber, pageWidth, pageHeight]);

  const pageContentImagesOptions = {
    contents,
    loadingStatuses: contentImages.loadingStatuses,
    requestedDataContentIds: contentImages.requestedDataContentIds,
    pageNumber,
    envelopeItemId: currentEnvelopeItem?.id ?? '',
  };

  const hasFailedImage = hasFailedContentImage(pageContentImagesOptions);

  /**
   * Latched once true: readiness only delays the initial render and never
   * tears down a live page, e.g. when the editor's contents gain a new image
   * which is then drawn progressively.
   */
  const hasBeenReady = useRef(false);

  if (!hasBeenReady.current && areContentImagesReady(pageContentImagesOptions)) {
    hasBeenReady.current = true;
  }

  const isReady = imageLoadingState === 'loaded' && hasBeenReady.current;

  useEffect(() => {
    onReadyChange?.(isReady);
  }, [isReady, onReadyChange]);

  const stage = useRef<Konva.Stage | null>(null);
  const pageLayer = useRef<Konva.Layer | null>(null);

  const fieldsVisibility = resolvePageItemsVisibility(
    viewerControls.fieldsVisibility,
    options.fieldsVisibility ?? 'visible',
  );

  const contentsVisibility = resolvePageItemsVisibility(
    viewerControls.contentsVisibility,
    options.contentsVisibility ?? 'visible',
  );

  // One applier per item kind, since each tracks its own muted state for the
  // lifetime of the page (including across stage recreation).
  const [applyFieldsVisibility] = useState(createPageItemsVisibilityApplier);
  const [applyContentsVisibility] = useState(createPageItemsVisibilityApplier);

  /**
   * Renderers which re-render groups outside of page creation and visibility
   * changes must call this after drawing, or the new groups ignore the
   * current visibility.
   */
  const applyPageItemsVisibility = useCallback(() => {
    const layer = pageLayer.current;

    if (!layer) {
      return;
    }

    applyFieldsVisibility(layer.find('.field-group'), fieldsVisibility);
    applyContentsVisibility(layer.find('.content-group'), contentsVisibility);

    layer.batchDraw();
  }, [fieldsVisibility, contentsVisibility]);

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

    if (!container || !isReady) {
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

    applyPageItemsVisibility();

    void document.fonts.ready.then(() => {
      pageLayer.current?.batchDraw();
    });

    return () => {
      stage.current?.destroy();
      stage.current = null;
    };
  }, [isReady, scaledViewport]);

  useEffect(() => {
    applyPageItemsVisibility();
  }, [applyPageItemsVisibility]);

  return {
    konvaContainer,
    stage,
    pageLayer,
    unscaledViewport,
    scaledViewport,
    fieldsVisibility,
    contentsVisibility,
    applyPageItemsVisibility,

    isReady,

    hasFailedImage,
  };
};
