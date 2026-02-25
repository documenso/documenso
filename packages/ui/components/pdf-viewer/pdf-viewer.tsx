import React, { useEffect, useMemo, useRef, useState } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import type { EnvelopeItem } from '@prisma/client';

import { PDF_VIEWER_PAGE_CLASSNAME } from '@documenso/lib/constants/pdf-viewer';
import type { DocumentDataVersion } from '@documenso/lib/types/document-data';
import {
  getEnvelopeItemMetaUrl,
  getEnvelopeItemPageImageUrl,
} from '@documenso/lib/utils/envelope-images';
import type { TGetEnvelopeItemsMetaResponse } from '@documenso/remix/server/api/files/files.types';

import { cn } from '../../lib/utils';
import { useToast } from '../../primitives/use-toast';
import type { ScrollTarget } from '../virtual-list/use-virtual-list';
import { useVirtualList } from '../virtual-list/use-virtual-list';
import { PdfViewerErrorState, PdfViewerLoadingState } from './pdf-viewer-states';
import { useScrollToPage } from './use-scroll-to-page';

export type OverrideImage = {
  image: string;
  width: number;
  height: number;
};

export type OnPDFViewerPageClick = (_event: {
  pageNumber: number;
  numPages: number;
  originalEvent: React.MouseEvent<HTMLDivElement, MouseEvent>;
  pageHeight: number;
  pageWidth: number;
  pageX: number;
  pageY: number;
}) => void | Promise<void>;

type PageMeta = {
  imageUrl: string;
  width: number;
  height: number;
  documentDataId: string;
};

type LoadingState = 'loading' | 'loaded' | 'error';

export type PDFViewerProps = {
  className?: string;
  envelopeItem: Pick<EnvelopeItem, 'id' | 'envelopeId'>;
  token: string | undefined;
  presignToken?: string | undefined;
  version: DocumentDataVersion;

  /**
   * Ref to the scrollable parent container that handles scrolling.
   *
   * This must point to an element with `overflow-y: auto` or `overflow-y: scroll`
   * that is an ancestor of this component, or `'window'` to use the browser
   * window as the scroll container.
   */
  scrollParentRef: ScrollTarget;

  onDocumentLoad?: () => void;
  overrideImages?: OverrideImage[];
} & React.HTMLAttributes<HTMLDivElement>;

export const PDFViewer = ({
  className,
  envelopeItem,
  token,
  presignToken,
  version,
  scrollParentRef,
  onDocumentLoad,
  overrideImages,
  ...props
}: PDFViewerProps) => {
  const { _ } = useLingui();
  const { toast } = useToast();

  const $el = useRef<HTMLDivElement>(null);

  const [loadingState, setLoadingState] = useState<LoadingState>(
    overrideImages ? 'loaded' : 'loading',
  );
  const [pages, setPages] = useState<PageMeta[]>([]);

  const numPages = overrideImages ? overrideImages.length : pages.length;

  const derivedPages = useMemo((): PageMeta[] => {
    if (overrideImages) {
      return overrideImages.map((image) => ({
        imageUrl: image.image,
        width: image.width,
        height: image.height,
        documentDataId: '',
      }));
    }

    return pages;
  }, [overrideImages, pages]);

  // Fetch metadata when not using override images
  useEffect(() => {
    if (overrideImages) {
      setLoadingState('loaded');
      return;
    }

    const fetchMetadata = async () => {
      try {
        setLoadingState('loading');

        const metaUrl = getEnvelopeItemMetaUrl({
          envelopeId: envelopeItem.envelopeId,
          token,
          presignToken,
        });

        const response = await fetch(metaUrl);

        if (!response.ok) {
          throw new Error(`Failed to fetch envelope meta: ${response.status}`);
        }

        const data: TGetEnvelopeItemsMetaResponse = await response.json();

        // Find the specific envelope item
        const itemMeta = data.envelopeItems.find((item) => item.envelopeItemId === envelopeItem.id);

        if (!itemMeta) {
          throw new Error('Envelope item not found in metadata');
        }

        // Map pages to our internal format
        const mappedPages: PageMeta[] = itemMeta.pages.map((page, pageIndex) => {
          const imageUrl = getEnvelopeItemPageImageUrl({
            envelopeId: envelopeItem.envelopeId,
            envelopeItemId: envelopeItem.id,
            documentDataId: itemMeta.documentDataId,
            pageIndex,
            token,
            presignToken,
            version,
          });

          return {
            imageUrl,
            width: page.originalWidth,
            height: page.originalHeight,
            documentDataId: itemMeta.documentDataId,
          };
        });

        setPages(mappedPages);
        setLoadingState('loaded');
      } catch (err) {
        console.error(err);
        setLoadingState('error');

        toast({
          title: _(msg`Error`),
          description: _(msg`An error occurred while loading the document.`),
          variant: 'destructive',
        });
      }
    };

    void fetchMetadata();
  }, [envelopeItem.envelopeId, envelopeItem.id, token, presignToken, version, overrideImages]);

  // Notify when document is loaded
  useEffect(() => {
    if (loadingState === 'loaded' && onDocumentLoad) {
      onDocumentLoad();
    }
  }, [loadingState, onDocumentLoad]);

  const isLoading = loadingState === 'loading';
  const hasError = loadingState === 'error';

  return (
    <div ref={$el} className={cn('w-full', className)} {...props}>
      {/* Loading State */}
      {isLoading && <PdfViewerLoadingState />}

      {/* Error State */}
      {hasError && <PdfViewerErrorState />}

      {/* Loaded State */}
      {loadingState === 'loaded' && numPages > 0 && (
        <VirtualizedPageList
          scrollParentRef={scrollParentRef}
          constraintRef={$el}
          numPages={numPages}
          pages={derivedPages}
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
};

// Note: There is a duplicate of this component in `EnvelopePdfViewer`.
// This current component is for V1 and legacy use cases.
const VirtualizedPageList = ({
  scrollParentRef,
  constraintRef,
  pages,
  numPages,
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
      return scaledHeight + 32;
    },
    overscan: 5,
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
        const scale = constraintWidth / pageMeta.width;

        const scaledWidth = pageMeta.width * scale;
        const scaledHeight = pageMeta.height * scale;

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
            <div className="overflow-hidden rounded border border-border">
              <div className="relative w-full" style={{ width: scaledWidth, height: scaledHeight }}>
                <img
                  data-page-number={pageNumber}
                  src={pageMeta.imageUrl}
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

export default PDFViewer;
