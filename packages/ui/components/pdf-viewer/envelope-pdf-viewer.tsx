import React, { useEffect, useMemo, useRef } from 'react';

import type { MessageDescriptor } from '@lingui/core';
import { Trans, useLingui } from '@lingui/react/macro';

import type {
  BasePageRenderData,
  PageRenderData,
} from '@documenso/lib/client-only/providers/envelope-render-provider';
import { useCurrentEnvelopeRender } from '@documenso/lib/client-only/providers/envelope-render-provider';
import { PDF_VIEWER_PAGE_CLASSNAME } from '@documenso/lib/constants/pdf-viewer';
import { PDF_VIEWER_ERROR_MESSAGES } from '@documenso/lib/constants/pdf-viewer-i18n';
import { cn } from '@documenso/ui/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@documenso/ui/primitives/alert';

import type { ScrollTarget } from '../virtual-list/use-virtual-list';
import { useVirtualList } from '../virtual-list/use-virtual-list';
import { PdfViewerErrorState, PdfViewerLoadingState } from './pdf-viewer-states';
import { useScrollToPage } from './use-scroll-to-page';

export type EnvelopePdfViewerProps = {
  className?: string;

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
   * Custom page renderer to use instead of just rendering the page as an image.
   *
   * Mainly used for when you want to render the page with Konva.
   */
  customPageRenderer?: React.FunctionComponent<{ pageData: PageRenderData }>;

  /**
   * The error message to render when there is an error.
   */
  errorMessage: { title: MessageDescriptor; description: MessageDescriptor } | null;
} & React.HTMLAttributes<HTMLDivElement>;

export const EnvelopePdfViewer = ({
  className,
  scrollParentRef,
  onDocumentLoad,
  customPageRenderer: CustomPageRenderer,
  errorMessage,
  ...props
}: EnvelopePdfViewerProps) => {
  const { t } = useLingui();

  const $el = useRef<HTMLDivElement>(null);

  const { currentEnvelopeItem, envelopeItemsMeta, envelopeItemsMetaLoadingState, renderError } =
    useCurrentEnvelopeRender();

  /**
   * The metadata for the current item.
   *
   * `null` if no current item is selected.
   */
  const currentItemMeta = useMemo(() => {
    if (!currentEnvelopeItem) {
      return null;
    }

    return envelopeItemsMeta[currentEnvelopeItem.id] ?? null;
  }, [currentEnvelopeItem, envelopeItemsMeta]);

  const numPages = currentItemMeta?.length ?? 0;

  /**
   * Trigger the onDocumentLoad callback when the document is loaded.
   */
  useEffect(() => {
    if (envelopeItemsMetaLoadingState === 'loaded' && onDocumentLoad) {
      onDocumentLoad();
    }
  }, [envelopeItemsMetaLoadingState, onDocumentLoad]);

  const isLoading = envelopeItemsMetaLoadingState === 'loading';
  const hasError = envelopeItemsMetaLoadingState === 'error';

  return (
    <div ref={$el} className={cn('h-full w-full max-w-[800px]', className)} {...props}>
      {renderError && (
        <Alert variant="destructive" className="mb-4 max-w-[800px]">
          <AlertTitle>
            {t(errorMessage?.title || PDF_VIEWER_ERROR_MESSAGES.default.title)}
          </AlertTitle>
          <AlertDescription>
            {t(errorMessage?.description || PDF_VIEWER_ERROR_MESSAGES.default.description)}
          </AlertDescription>
        </Alert>
      )}

      {/* Loading State */}
      {isLoading && <PdfViewerLoadingState />}

      {/* Error State */}
      {hasError && <PdfViewerErrorState />}

      {/* Render pages in a virtualized list. */}
      {envelopeItemsMetaLoadingState === 'loaded' &&
        currentEnvelopeItem &&
        currentItemMeta &&
        numPages > 0 && (
          <VirtualizedPageList
            scrollParentRef={scrollParentRef}
            constraintRef={$el}
            pages={currentItemMeta}
            envelopeItemId={currentEnvelopeItem.id}
            numPages={numPages}
            CustomPageRenderer={CustomPageRenderer}
          />
        )}

      {/* No current item selected */}
      {envelopeItemsMetaLoadingState === 'loaded' && !currentEnvelopeItem && (
        <div className="flex h-[80vh] max-h-[60rem] w-full flex-col items-center justify-center overflow-hidden rounded">
          <p className="text-sm text-muted-foreground">
            <Trans>No document selected</Trans>
          </p>
        </div>
      )}
    </div>
  );
};

type VirtualizedPageListProps = {
  scrollParentRef: ScrollTarget;
  constraintRef: React.RefObject<HTMLDivElement>;
  pages: BasePageRenderData[];
  envelopeItemId: string;
  numPages: number;
  CustomPageRenderer?: React.FunctionComponent<{ pageData: PageRenderData }>;
};

// Note: There is a duplicate of this component in `PDFViewer`.
const VirtualizedPageList = ({
  scrollParentRef,
  constraintRef,
  pages,
  envelopeItemId,
  numPages,
  CustomPageRenderer,
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
      const aspectRatio = pageMeta.pageHeight / pageMeta.pageWidth;
      const scaledHeight = width * aspectRatio;

      // Add 32px for the page number text and margins (my-2 = 8px * 2 + text height ~16px)
      return scaledHeight + 32;
    },
    overscan: 10,
  });

  useScrollToPage(contentRef, scrollToItem);

  return (
    <div
      ref={contentRef}
      data-pdf-content=""
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
        const scale = constraintWidth / pageMeta.pageWidth;

        const pageData: PageRenderData = {
          ...pageMeta,
          scale,
        };

        return (
          <div
            key={envelopeItemId + '-' + virtualItem.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: constraintWidth,
              height: `${virtualItem.size}px`,
              transform: `translateY(${virtualItem.start}px)`,
            }}
          >
            <div className="rounded border border-border">
              {CustomPageRenderer ? (
                <CustomPageRenderer pageData={pageData} />
              ) : (
                <ImagePageRenderer pageData={pageData} />
              )}
            </div>

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

const ImagePageRenderer = ({ pageData }: { pageData: PageRenderData }) => {
  const { pageWidth, pageHeight, scale, imageUrl, pageNumber } = pageData;

  const scaledWidth = pageWidth * scale;
  const scaledHeight = pageHeight * scale;

  return (
    <div className="relative w-full" style={{ width: scaledWidth, height: scaledHeight }}>
      <img
        data-page-number={pageNumber}
        src={imageUrl}
        alt=""
        className={cn(PDF_VIEWER_PAGE_CLASSNAME, 'absolute inset-0 z-0 block')}
        style={{
          width: scaledWidth,
          height: scaledHeight,
        }}
        draggable={false}
        loading="lazy"
      />
    </div>
  );
};

export default EnvelopePdfViewer;
