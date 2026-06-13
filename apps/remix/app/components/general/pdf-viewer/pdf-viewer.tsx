import type { ImageLoadingState, PageRenderData } from '@documenso/lib/client-only/providers/envelope-render-provider';
import { PDF_VIEWER_PAGE_CLASSNAME } from '@documenso/lib/constants/pdf-viewer';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import { useToast } from '@documenso/ui/primitives/use-toast';
import { Trans, useLingui } from '@lingui/react/macro';
import { MinusIcon, PlusIcon, RotateCcwIcon } from 'lucide-react';
import pMap from 'p-map';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker?url';
import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';

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
const DEFAULT_ZOOM = 1;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2;
const ZOOM_STEP = 0.25;

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
  customPageRenderer,
  ...props
}: PDFViewerProps) {
  const { t } = useLingui();
  const { toast } = useToast();

  const $el = useRef<HTMLDivElement>(null);

  const [loadingState, setLoadingState] = useState<LoadingState>('loading');
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);

  const canZoomOut = zoom > MIN_ZOOM;
  const canZoomIn = zoom < MAX_ZOOM;

  const zoomOut = () => {
    setZoom((currentZoom) => Math.max(MIN_ZOOM, currentZoom - ZOOM_STEP));
  };

  const resetZoom = () => {
    setZoom(DEFAULT_ZOOM);
  };

  const zoomIn = () => {
    setZoom((currentZoom) => Math.min(MAX_ZOOM, currentZoom + ZOOM_STEP));
  };

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
        setZoom(DEFAULT_ZOOM);

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

        if (!result) {
          throw new Error('Failed to load PDF data');
        }

        const loadedPdf = await pdfjsLib.getDocument({ data: result, cMapUrl: '/static/cmaps/' }).promise;

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
    <div ref={$el} className={cn('h-full w-full overflow-x-auto', className)} {...props}>
      {/* Loading State */}
      {isLoading && <PdfViewerLoadingState />}

      {/* Error State */}
      {hasError && <PdfViewerErrorState />}

      {loadingState === 'loaded' && (
        <div className="sticky top-2 right-2 z-20 ml-auto flex w-fit items-center gap-1 rounded-md border bg-background/95 p-1 shadow-sm">
          <Button
            type="button"
            variant="ghost"
            className="h-8 w-8 p-0"
            disabled={!canZoomOut}
            aria-label={t`Zoom out`}
            onClick={zoomOut}
          >
            <MinusIcon className="h-4 w-4" />
            <span className="sr-only">
              <Trans>Zoom out</Trans>
            </span>
          </Button>

          <Button
            type="button"
            variant="ghost"
            className="h-8 min-w-12 px-2 font-medium text-xs tabular-nums"
            disabled={zoom === DEFAULT_ZOOM}
            aria-label={t`Reset zoom`}
            onClick={resetZoom}
          >
            <RotateCcwIcon className="mr-1 h-3.5 w-3.5" />
            {Math.round(zoom * 100)}%
          </Button>

          <Button
            type="button"
            variant="ghost"
            className="h-8 w-8 p-0"
            disabled={!canZoomIn}
            aria-label={t`Zoom in`}
            onClick={zoomIn}
          >
            <PlusIcon className="h-4 w-4" />
            <span className="sr-only">
              <Trans>Zoom in</Trans>
            </span>
          </Button>
        </div>
      )}

      {/* Loaded State */}
      {loadingState === 'loaded' && pages.length > 0 && pdfRef.current && (
        <VirtualizedPageList
          scrollParentRef={scrollParentRef}
          constraintRef={$el}
          numPages={pages.length}
          pages={pages}
          pdf={pdfRef.current}
          zoom={zoom}
          customPageRenderer={customPageRenderer}
        />
      )}
    </div>
  );
}

type VirtualizedPageListProps = {
  scrollParentRef: ScrollTarget;
  constraintRef: React.RefObject<HTMLDivElement>;
  pages: PageMeta[];
  numPages: number;
  pdf: pdfjsLib.PDFDocumentProxy;
  customPageRenderer?: React.FunctionComponent<{ pageData: PageRenderData }>;
  zoom: number;
};

const VirtualizedPageList = ({
  scrollParentRef,
  constraintRef,
  pages,
  numPages,
  pdf,
  customPageRenderer,
  zoom,
}: VirtualizedPageListProps) => {
  const contentRef = useRef<HTMLDivElement>(null);

  const { virtualItems, totalSize, constraintWidth, scrollToItem } = useVirtualList({
    scrollRef: scrollParentRef,
    constraintRef,
    contentRef,
    itemCount: numPages,
    itemSize: (index, width) => {
      const pageMeta = pages[index];

      // Calculate height based on aspect ratio and zoomed width
      const aspectRatio = pageMeta.height / pageMeta.width;
      const scaledHeight = width * zoom * aspectRatio;

      // Add 32px for the page number text and margins (my-2 = 8px * 2 + text height ~16px)
      // Add additional 2px for the top and bottom borders.
      return scaledHeight + 32 + 2;
    },
    overscan: 5,
  });

  useScrollToPage(contentRef, scrollToItem);

  return (
    <div
      ref={contentRef}
      // Note: This is actually used.
      data-pdf-content=""
      data-page-count={numPages}
      style={{
        height: `${totalSize}px`,
        width: `${Math.max(constraintWidth, constraintWidth * zoom)}px`,
        position: 'relative',
      }}
    >
      {virtualItems.map((virtualItem) => {
        const index = virtualItem.index;
        const pageMeta = pages[index];
        const pageNumber = index + 1;

        // Calculate scale based on fit-to-width plus viewer zoom
        const pageDisplayWidth = constraintWidth * zoom;
        const scale = pageDisplayWidth / pageMeta.width;

        const scaledWidth = Math.floor(pageMeta.width * scale);
        const scaledHeight = Math.floor(pageMeta.height * scale);

        return (
          <div
            className="flex flex-col items-center"
            key={virtualItem.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: Math.max(constraintWidth, scaledWidth),
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

            <p className="my-2 text-center text-[11px] text-muted-foreground/80">
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

  return (
    <div className="relative w-full rounded border border-border" style={{ width: scaledWidth, height: scaledHeight }}>
      {CustomPageRenderer && imageLoadingState === 'loaded' && (
        <CustomPageRenderer
          pageData={{
            scale,
            pageIndex: pageNumber - 1,
            pageNumber,
            pageWidth: unscaledWidth,
            pageHeight: unscaledHeight,
            imageLoadingState,
          }}
        />
      )}

      <PdfViewerPageImage imageLoadingState={imageLoadingState} imageProps={imageProps} />
    </div>
  );
};

/**
 * Manages rendering a page from a pdf.
 */
const usePdfPageImage = ({ pageNumber, pdf, scale, scaledWidth, scaledHeight }: PdfViewerPageProps) => {
  const [imageLoadingState, setImageLoadingState] = useState<ImageLoadingState>('loading');

  const [imageUrl, setImageUrl] = useState('');
  const renderTaskRef = useRef<pdfjsLib.RenderTask | null>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const renderedResolutionRef = useRef<number | null>(null);
  const renderedScaleRef = useRef<number | null>(null);
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
        renderedResolutionRef.current === resolution &&
        renderedScaleRef.current === scale
      );
    };

    const setRenderedImageMeta = (resolution: number) => {
      renderedPdfRef.current = pdf;
      renderedPageNumberRef.current = pageNumber;
      renderedResolutionRef.current = resolution;
      renderedScaleRef.current = scale;
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
      width: Math.floor(scaledWidth),
      height: Math.floor(scaledHeight),
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
