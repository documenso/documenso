import React, { useEffect, useMemo, useRef, useState } from 'react';

import { Trans, useLingui } from '@lingui/react/macro';
import pMap from 'p-map';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker?url';

import type {
  ImageLoadingState,
  PageRenderData,
} from '@documenso/lib/client-only/providers/envelope-render-provider';
import { PDF_VIEWER_PAGE_CLASSNAME } from '@documenso/lib/constants/pdf-viewer';
import { cn } from '@documenso/ui/lib/utils';
import { useToast } from '@documenso/ui/primitives/use-toast';

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

export type PDFViewerProps = {
  className?: string;

  /**
   * The PDF data to render.
   *
   * If it's a URL, it will be fetched and rendered.
   */
  data: Uint8Array | string;

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

export const PDFViewer = ({
  className,
  data,
  scrollParentRef,
  onDocumentLoad,
  customPageRenderer,
  ...props
}: PDFViewerProps) => {
  const { t } = useLingui();
  const { toast } = useToast();

  const $el = useRef<HTMLDivElement>(null);

  const [loadingState, setLoadingState] = useState<LoadingState>('loading');

  const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null);

  const [pages, setPages] = useState<PageMeta[]>([]);

  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        setLoadingState('loading');
        setPages([]);

        let result: Uint8Array | null = typeof data === 'string' ? null : new Uint8Array(data);

        if (typeof data === 'string') {
          const response = await fetch(data);

          if (!response.ok) {
            throw new Error(`Failed to fetch PDF data: ${response.status}`);
          }

          result = new Uint8Array(await response.arrayBuffer());
        }

        const loadedPdf = await pdfjsLib.getDocument({ data: result! }).promise;

        if (pdf) {
          await pdf.destroy();
        }

        setPdf(loadedPdf);

        // Fetch the pages
        const pages = await pMap(
          Array.from({ length: loadedPdf.numPages }),
          async (_, pageIndex) => {
            const page = await loadedPdf.getPage(pageIndex + 1);
            const viewport = page.getViewport({ scale: 1 });

            return {
              width: viewport.width,
              height: viewport.height,
            };
          },
        );

        setPages(pages);

        setLoadingState('loaded');
      } catch (err) {
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
      if (pdf) {
        void pdf.destroy();
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

  return (
    <div ref={$el} className={cn('h-full w-full', className)} {...props}>
      {/* Loading State */}
      {isLoading && <PdfViewerLoadingState />}

      {/* Error State */}
      {hasError && <PdfViewerErrorState />}

      {/* Loaded State */}
      {loadingState === 'loaded' && pages.length > 0 && pdf && (
        <VirtualizedPageList
          scrollParentRef={scrollParentRef}
          constraintRef={$el}
          numPages={pages.length}
          pages={pages}
          pdf={pdf}
          customPageRenderer={customPageRenderer}
        />
      )}
    </div>
  );
};

type VirtualizedPageListProps = {
  scrollParentRef: ScrollTarget;
  constraintRef: React.RefObject<HTMLDivElement>;
  pages: PageMeta[];
  numPages: number;
  pdf: pdfjsLib.PDFDocumentProxy;
  customPageRenderer?: React.FunctionComponent<{ pageData: PageRenderData }>;
};

const VirtualizedPageList = ({
  scrollParentRef,
  constraintRef,
  pages,
  numPages,
  pdf,
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

      // Calculate height based on aspect ratio and available width
      const aspectRatio = pageMeta.height / pageMeta.width;
      const scaledHeight = width * aspectRatio;

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
        width: '100%',
        position: 'relative',
      }}
    >
      {virtualItems.map((virtualItem) => {
        const index = virtualItem.index;
        const pageMeta = pages[index];
        const pageNumber = index + 1;

        // Calculate scale based on constraint width
        const scale = constraintWidth / pageMeta.width;

        const scaledWidth = Math.floor(pageMeta.width * scale);
        const scaledHeight = Math.floor(pageMeta.height * scale);

        return (
          <div
            key={virtualItem.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: constraintWidth,
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
    <div
      className="relative w-full rounded border border-border"
      style={{ width: scaledWidth, height: scaledHeight }}
    >
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
const usePdfPageImage = ({
  pageNumber,
  pdf,
  scale,
  scaledWidth,
  scaledHeight,
}: PdfViewerPageProps) => {
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
