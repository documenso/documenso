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
  /**
   * Additional fields visibility input which is composed with the viewer
   * controls visibility, where the most restrictive input wins.
   *
   * Used by renderers with extra context, e.g. the editor muting fields while
   * the contents tab is active.
   */
  fieldsVisibility?: EnvelopePageItemsVisibility;

  /**
   * Additional contents visibility input which is composed with the viewer
   * controls visibility, where the most restrictive input wins.
   */
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

  // Publish the page size so page relative geometry can be computed outside
  // the renderer, e.g. when sizing a content to an uploaded image.
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
   * Whether the images of this page's contents have finished loading, so the
   * page renders with its images in place rather than them popping in.
   *
   * Latched once true: readiness only delays the initial render and never
   * tears down a live page, e.g. when the editor's contents gain a new image
   * which is then drawn progressively.
   */
  const hasBeenReady = useRef(false);

  if (!hasBeenReady.current && areContentImagesReady(pageContentImagesOptions)) {
    hasBeenReady.current = true;
  }

  const isReady = imageLoadingState === 'loaded' && hasBeenReady.current;

  // The page holds back its image until everything drawn on it is ready, so
  // the two appear together rather than the page looking finished while its
  // contents are still loading.
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
   * Apply the current fields/contents visibility to all named groups on the
   * page layer.
   *
   * This is automatically applied when the page is created and when the
   * visibility changes. Renderers which re-render groups outside of those
   * moments should call this after drawing so newly created groups pick up
   * the current visibility.
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

  /**
   * Reapply the visibility whenever it changes.
   */
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

    /**
     * Whether the page bitmap and content images are ready and the stage has
     * been (or is about to be) created.
     */
    isReady,

    /**
     * Whether a content image on this page failed to load. Renderers decide
     * how to surface this, e.g. an error state for signers or a placeholder
     * for authors.
     */
    hasFailedImage,
  };
};
