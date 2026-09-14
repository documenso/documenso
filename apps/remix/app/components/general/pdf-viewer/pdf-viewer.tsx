import { useAnalytics } from '@documenso/lib/client-only/hooks/use-analytics';
import type { ImageLoadingState, PageRenderData } from '@documenso/lib/client-only/providers/envelope-render-provider';
import { PDF_VIEWER_PAGE_CLASSNAME } from '@documenso/lib/constants/pdf-viewer';
import { cn } from '@documenso/ui/lib/utils';
import { useToast } from '@documenso/ui/primitives/use-toast';
import { Trans, useLingui } from '@lingui/react/macro';
import pMap from 'p-map';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker?url';
import type React from 'react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import type { ScrollTarget } from '../virtual-list/use-virtual-list';
import { useVirtualList } from '../virtual-list/use-virtual-list';
import { PdfViewerPageImage } from './pdf-viewer-page-image';
import { PdfViewerErrorState, PdfViewerLoadingState } from './pdf-viewer-states';
import { useScrollToPage } from './use-scroll-to-page';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

type PageMeta = {
  width: number;
  height: number;
};

type LoadingState = 'loading' | 'loaded' | 'error';

const LOW_RENDER_RESOLUTION = 1;
const HIGH_RENDER_RESOLUTION = 2;
const IDLE_RENDER_DELAY = 200;

/**
 * The additional height of each virtual page item on top of the scaled page
 * height.
 *
 * 32px for the page number text and margins (my-2 = 8px * 2 + text height ~16px)
 * plus 2px so the page outline ring (drawn outside the page box) does not touch
 * the neighbouring items.
 */
const PAGE_ITEM_EXTRA_HEIGHT = 34;

export type PDFViewerProps = {
  className?: string;

  /**
   * The PDF data to render.
   *
   * If it's a URL, it will be fetched and rendered.
   *
   * If null will render an empty state.
   */
  data: Uint8Array | string | null;

  /**
   * Ref to the scrollable parent container that handles scrolling.
   *
   * This must point to an element with `overflow-y: auto` or `overflow-y: scroll`
   * that is an ancestor of this component, or `'window'` to use the browser
   * window as the scroll container.
   */
  scrollParentRef: ScrollTarget;

  onDocumentLoad?: () => void;

  /**
   * The zoom factor to render the pages at.
   *
   * The rendered page width is `min(containerWidth, maxPageWidth) * zoom`,
   * derived in the same render pass as the layout so zoom changes apply in a
   * single paint without any intermediate layout shift.
   *
   * Values above 1 can overflow the container horizontally, so the scroll
   * parent should allow horizontal scrolling.
   */
  zoom?: number;

  /**
   * The maximum base width of a page before the zoom is applied.
   */
  maxPageWidth?: number;

  /**
   * Additional component to render next to the image, such as a Konva canvas
   * for rendering fields.
   */
  customPageRenderer?: React.FunctionComponent<{ pageData: PageRenderData }>;
} & React.HTMLAttributes<HTMLDivElement>;

export default function PDFViewer({
  className,
  data,
  scrollParentRef,
  onDocumentLoad,
  zoom = 1,
  maxPageWidth,
  customPageRenderer,
  ...props
}: PDFViewerProps) {
  const { t } = useLingui();
  const { toast } = useToast();
  const analytics = useAnalytics();

  const $el = useRef<HTMLDivElement>(null);

  const [loadingState, setLoadingState] = useState<LoadingState>('loading');

  const pdfRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);

  const [pages, setPages] = useState<PageMeta[]>([]);

  useEffect(() => {
    if (!data) {
      return;
    }

    let isCancelled = false;

    const fetchMetadata = async () => {
      try {
        setLoadingState('loading');
        setPages([]);

        if (isCancelled) {
          return;
        }

        let result: Uint8Array | null = typeof data === 'string' ? null : new Uint8Array(data);

        if (typeof data === 'string') {
          const response = await fetch(data);

          if (!response.ok) {
            throw new Error(`Failed to fetch PDF data: ${response.status}`);
          }

          result = new Uint8Array(await response.arrayBuffer());
        }

        if (isCancelled) {
          return;
        }

        const loadedPdf = await pdfjsLib.getDocument({ data: result!, cMapUrl: '/static/cmaps/' }).promise;

        if (isCancelled) {
          await loadedPdf.destroy();
          return;
        }

        // Destroy previous PDF if it exists
        if (pdfRef.current) {
          await pdfRef.current.destroy();
        }

        // eslint-disable-next-line require-atomic-updates
        pdfRef.current = loadedPdf;

        // Fetch the pages
        const pages = await pMap(Array.from({ length: loadedPdf.numPages }), async (_, pageIndex) => {
          const page = await loadedPdf.getPage(pageIndex + 1);
          const viewport = page.getViewport({ scale: 1 });

          return {
            width: viewport.width,
            height: viewport.height,
          };
        });

        if (isCancelled) {
          return;
        }

        setPages(pages);

        setLoadingState('loaded');
      } catch (err) {
        if (isCancelled) {
          return;
        }

        console.error(err);
        setLoadingState('error');

        analytics.captureException(err, {
          source: 'pdf_viewer',
          location: 'pdf_load',
        });

        toast({
          title: t`Error`,
          description: t`An error occurred while loading the document.`,
          variant: 'destructive',
        });
      }
    };

    void fetchMetadata();

    return () => {
      isCancelled = true;

      if (pdfRef.current) {
        void pdfRef.current.destroy();
        pdfRef.current = null;
      }
    };
  }, [data]);

  // Notify when document is loaded
  useEffect(() => {
    if (loadingState === 'loaded' && onDocumentLoad) {
      onDocumentLoad();
    }
  }, [loadingState, onDocumentLoad]);

  const isLoading = loadingState === 'loading';
  const hasError = loadingState === 'error';

  if (!data) {
    return (
      <div ref={$el} className={cn('h-full w-full', className)} {...props}>
        <p className="py-32 text-center text-muted-foreground text-sm">
          <Trans>No document found</Trans>
        </p>
      </div>
    );
  }

  return (
    <div ref={$el} className={cn('h-full w-full', className)} {...props}>
      {/* Loading State */}
      {isLoading && <PdfViewerLoadingState />}

      {/* Error State */}
      {hasError && <PdfViewerErrorState />}

      {/* Loaded State */}
      {loadingState === 'loaded' && pages.length > 0 && pdfRef.current && (
        <VirtualizedPageList
          scrollParentRef={scrollParentRef}
          constraintRef={$el}
          numPages={pages.length}
          pages={pages}
          pdf={pdfRef.current}
          zoom={zoom}
          maxPageWidth={maxPageWidth}
          customPageRenderer={customPageRenderer}
        />
      )}
    </div>
  );
}

type VirtualizedPageListProps = {
  scrollParentRef: ScrollTarget;
  constraintRef: React.RefObject<HTMLDivElement | null>;
  pages: PageMeta[];
  numPages: number;
  pdf: pdfjsLib.PDFDocumentProxy;
  zoom: number;
  maxPageWidth?: number;
  customPageRenderer?: React.FunctionComponent<{ pageData: PageRenderData }>;
};

const VirtualizedPageList = ({
  scrollParentRef,
  constraintRef,
  pages,
  numPages,
  pdf,
  zoom,
  maxPageWidth,
  customPageRenderer,
}: VirtualizedPageListProps) => {
  const contentRef = useRef<HTMLDivElement>(null);

  const { virtualItems, totalSize, constraintWidth, scrollToItem } = useVirtualList({
    scrollRef: scrollParentRef,
    constraintRef,
    contentRef,
    itemCount: numPages,
    itemSize: (index, width) => {
      const pageMeta = pages[index];

      // Calculate height based on aspect ratio and the rendered page width.
      const aspectRatio = pageMeta.height / pageMeta.width;
      const scaledHeight = getDisplayWidth(width, zoom, maxPageWidth) * aspectRatio;

      return scaledHeight + PAGE_ITEM_EXTRA_HEIGHT;
    },
    overscan: 5,
  });

  /**
   * The width the pages are rendered at.
   *
   * Derived from the measured available width in the same render pass as the
   * zoom, so zoom changes update the page layout and page sizes within a
   * single commit, avoiding intermediate layout shifts.
   */
  const displayWidth = getDisplayWidth(constraintWidth, zoom, maxPageWidth);

  useScrollToPage(contentRef, scrollToItem);

  const previousDisplayWidthRef = useRef(displayWidth);

  /**
   * Anchor the scroll position when the rendered page width changes (zoom or
   * container resize) so zooming feels centered on the middle of the visible
   * area instead of the top left of the content.
   *
   * Keeps the content point at the vertical center of the viewport stable, and
   * keeps the pages horizontally centered within the scrollport.
   */
  useLayoutEffect(() => {
    const previousDisplayWidth = previousDisplayWidthRef.current;
    previousDisplayWidthRef.current = displayWidth;

    if (previousDisplayWidth === displayWidth || previousDisplayWidth === 0 || displayWidth === 0) {
      return;
    }

    const contentEl = contentRef.current;
    const scrollEl = scrollParentRef === 'window' ? document.scrollingElement : scrollParentRef.current;

    if (!contentEl || !scrollEl) {
      return;
    }

    const viewportHeight = scrollParentRef === 'window' ? window.innerHeight : scrollEl.clientHeight;

    // The offset of the content element from the top of the scrollable content.
    // Only depends on the content above the page list, which is unaffected by zoom.
    const contentOffsetTop =
      contentEl.getBoundingClientRect().top -
      (scrollParentRef === 'window' ? 0 : scrollEl.getBoundingClientRect().top) +
      scrollEl.scrollTop;

    const oldMetrics = computePageMetrics(pages, previousDisplayWidth);
    const newMetrics = computePageMetrics(pages, displayWidth);

    // The content-space Y coordinate currently at the vertical center of the viewport.
    const oldCenterY = Math.min(
      Math.max(0, scrollEl.scrollTop + viewportHeight / 2 - contentOffsetTop),
      oldMetrics.totalSize,
    );

    // Locate which page the center point is on, and how far through it.
    let pageIndex = 0;

    for (let i = 0; i < pages.length; i += 1) {
      if (oldMetrics.offsets[i] <= oldCenterY) {
        pageIndex = i;
      } else {
        break;
      }
    }

    const pageFraction =
      oldMetrics.sizes[pageIndex] > 0 ? (oldCenterY - oldMetrics.offsets[pageIndex]) / oldMetrics.sizes[pageIndex] : 0;

    const newCenterY = newMetrics.offsets[pageIndex] + pageFraction * newMetrics.sizes[pageIndex];

    scrollEl.scrollTop = Math.max(0, newCenterY + contentOffsetTop - viewportHeight / 2);
    scrollEl.scrollLeft = Math.max(0, (scrollEl.scrollWidth - scrollEl.clientWidth) / 2);
  }, [displayWidth, pages, scrollParentRef]);

  return (
    <div
      ref={contentRef}
      // Note: This is actually used.
      data-pdf-content=""
      data-page-count={numPages}
      style={{
        height: `${totalSize}px`,
        width: displayWidth > 0 ? `${displayWidth}px` : '100%',
        // Center the pages when they fit within the container, while safely
        // falling back to a start alignment when they overflow so the scroll
        // container can reach all of the content.
        margin: '0 auto',
        position: 'relative',
      }}
    >
      {virtualItems.map((virtualItem) => {
        const index = virtualItem.index;
        const pageMeta = pages[index];
        const pageNumber = index + 1;

        // Calculate scale based on the rendered page width.
        const scale = displayWidth / pageMeta.width;

        // The page is rendered exactly `displayWidth` wide by definition of the
        // scale. Flooring `pageMeta.width * scale` could lose a pixel to floating
        // point error, which would put the page image and the Konva overlay at
        // slightly different sizes.
        const scaledWidth = displayWidth;
        const scaledHeight = Math.round(pageMeta.height * scale);

        return (
          <div
            key={virtualItem.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: displayWidth,
              height: `${virtualItem.size}px`,
              transform: `translateY(${virtualItem.start}px)`,
            }}
          >
            <PdfViewerPage
              unscaledWidth={pageMeta.width}
              unscaledHeight={pageMeta.height}
              scaledWidth={scaledWidth}
              scaledHeight={scaledHeight}
              pageNumber={pageNumber}
              pdf={pdf}
              scale={scale}
              customPageRenderer={customPageRenderer}
            />

            <p
              className={cn('my-2 text-center text-[11px] text-muted-foreground/80', {
                // Allocate room for the floating viewer toolbar.
                'pb-20': index === numPages - 1,
              })}
            >
              <Trans>
                Page {pageNumber} of {numPages}
              </Trans>
            </p>
          </div>
        );
      })}
    </div>
  );
};

/**
 * The width pages are rendered at for a given available width, zoom and
 * maximum base page width.
 */
const getDisplayWidth = (constraintWidth: number, zoom: number, maxPageWidth?: number) => {
  if (constraintWidth === 0) {
    return 0;
  }

  const baseWidth = maxPageWidth !== undefined ? Math.min(constraintWidth, maxPageWidth) : constraintWidth;

  return Math.floor(baseWidth * zoom);
};

/**
 * Compute the virtual list offsets and sizes of every page for a given
 * rendered page width.
 *
 * Must mirror the `itemSize` calculation used for the virtual list.
 */
const computePageMetrics = (pages: PageMeta[], displayWidth: number) => {
  const offsets: number[] = [];
  const sizes: number[] = [];

  let totalSize = 0;

  for (const pageMeta of pages) {
    const aspectRatio = pageMeta.height / pageMeta.width;
    const size = displayWidth * aspectRatio + PAGE_ITEM_EXTRA_HEIGHT;

    offsets.push(totalSize);
    sizes.push(size);
    totalSize += size;
  }

  return { offsets, sizes, totalSize };
};

type PdfViewerPageProps = {
  pageNumber: number;
  pdf: pdfjsLib.PDFDocumentProxy;
  unscaledWidth: number;
  unscaledHeight: number;
  scaledWidth: number;
  scaledHeight: number;
  scale: number;
  customPageRenderer?: React.FunctionComponent<{ pageData: PageRenderData }>;
};

const PdfViewerPage = ({
  pageNumber,
  pdf,
  unscaledWidth,
  unscaledHeight,
  scaledWidth,
  scaledHeight,
  scale,
  customPageRenderer: CustomPageRenderer,
}: PdfViewerPageProps) => {
  const { imageProps, imageLoadingState } = usePdfPageImage({
    pageNumber,
    pdf,
    unscaledWidth,
    unscaledHeight,
    scaledWidth,
    scaledHeight,
    scale,
  });

  /**
   * A custom page renderer may have to load things of its own before the page
   * can be drawn, which it can only begin once the page image is ready. The
   * page image is held back until then so both appear at once.
   */
  const [isCustomRendererReady, setIsCustomRendererReady] = useState(false);

  const isPageReady = imageLoadingState === 'loaded' && (!CustomPageRenderer || isCustomRendererReady);

  return (
    // Must use ring instead of border since borders take up space inside the box,
    // which shrinks the page image (constrained to the box by `max-width: 100%`)
    <div className="relative w-full rounded ring-1 ring-border" style={{ width: scaledWidth, height: scaledHeight }}>
      {CustomPageRenderer && imageLoadingState === 'loaded' && (
        <CustomPageRenderer
          pageData={{
            scale,
            pageIndex: pageNumber - 1,
            pageNumber,
            pageWidth: unscaledWidth,
            pageHeight: unscaledHeight,
            imageLoadingState,
            onReadyChange: setIsCustomRendererReady,
          }}
        />
      )}

      <PdfViewerPageImage imageLoadingState={imageLoadingState} isPageReady={isPageReady} imageProps={imageProps} />
    </div>
  );
};

/**
 * Manages rendering a page from a pdf.
 */
const usePdfPageImage = ({ pageNumber, pdf, scale, scaledWidth, scaledHeight }: PdfViewerPageProps) => {
  const analytics = useAnalytics();

  const [imageLoadingState, setImageLoadingState] = useState<ImageLoadingState>('loading');

  const [imageUrl, setImageUrl] = useState('');
  const renderTaskRef = useRef<pdfjsLib.RenderTask | null>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const renderedResolutionRef = useRef<number | null>(null);
  const renderedPageNumberRef = useRef<number | null>(null);
  const renderedPdfRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);

  useEffect(() => {
    let isCancelled = false;

    const cancelRenderTask = () => {
      if (!renderTaskRef.current) {
        return;
      }

      renderTaskRef.current.cancel();
      renderTaskRef.current = null;
    };

    const hasMatchingRenderedImage = (resolution: number) => {
      return (
        renderedPdfRef.current === pdf &&
        renderedPageNumberRef.current === pageNumber &&
        renderedResolutionRef.current === resolution
      );
    };

    const setRenderedImageMeta = (resolution: number) => {
      renderedPdfRef.current = pdf;
      renderedPageNumberRef.current = pageNumber;
      renderedResolutionRef.current = resolution;
    };

    const renderAtResolution = async (resolution: number) => {
      let currentTask: pdfjsLib.RenderTask | null = null;

      try {
        if (isCancelled) {
          return;
        }

        if (hasMatchingRenderedImage(resolution)) {
          return;
        }

        cancelRenderTask();

        const page = await pdf.getPage(pageNumber);

        if (isCancelled) {
          return;
        }

        const renderScale = scale * resolution;
        const viewport = page.getViewport({ scale: renderScale });
        const canvas = document.createElement('canvas');
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);

        const context = canvas.getContext('2d');

        if (!context) {
          throw new Error('Failed to get canvas context');
        }

        currentTask = page.render({
          canvasContext: context,
          viewport,
          canvas,
        });
        renderTaskRef.current = currentTask;

        await currentTask.promise;

        if (isCancelled || renderTaskRef.current !== currentTask) {
          return;
        }

        setRenderedImageMeta(resolution);

        setImageUrl(canvas.toDataURL('image/jpeg'));
      } catch (err) {
        if (err instanceof Error && err.name === 'RenderingCancelledException') {
          return;
        }

        if (!isCancelled) {
          console.error(err);

          analytics.captureException(err, {
            source: 'pdf_viewer',
            location: 'pdf_page_render',
          });

          setImageLoadingState('error');
        }
      } finally {
        if (renderTaskRef.current === currentTask) {
          renderTaskRef.current = null;
        }
      }
    };

    void renderAtResolution(LOW_RENDER_RESOLUTION);

    idleTimerRef.current = setTimeout(() => {
      void renderAtResolution(HIGH_RENDER_RESOLUTION);
    }, IDLE_RENDER_DELAY);

    return () => {
      isCancelled = true;

      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }

      cancelRenderTask();
    };
  }, [pdf, pageNumber, scale]);

  const imageProps = useMemo(
    (): React.ImgHTMLAttributes<HTMLImageElement> & Record<string, unknown> & { alt: '' } => ({
      className: PDF_VIEWER_PAGE_CLASSNAME,
      width: scaledWidth,
      height: scaledHeight,
      // Pin the rendered size to the page size. Tailwind's preflight applies
      // `max-width: 100%; height: auto` to images, which would otherwise let
      // the container clamp the image out of alignment with the page overlay.
      style: {
        width: scaledWidth,
        height: scaledHeight,
        maxWidth: 'none',
      },
      alt: '',
      onLoad: () => setImageLoadingState('loaded'),
      onError: () => setImageLoadingState('error'),
      src: imageUrl,
      'data-page-number': pageNumber,
      draggable: false,
    }),
    [scaledWidth, scaledHeight, imageUrl, pageNumber],
  );

  return {
    imageProps,
    imageLoadingState,
  };
};
