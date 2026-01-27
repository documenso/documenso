import React, { useEffect, useMemo, useRef, useState } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import type { EnvelopeItem } from '@prisma/client';
import { base64 } from '@scure/base';
import { Loader } from 'lucide-react';
import { type PDFDocumentProxy } from 'pdfjs-dist';
import { Document as PDFDocument, Page as PDFPage, pdfjs } from 'react-pdf';

import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { PDF_VIEWER_PAGE_SELECTOR } from '@documenso/lib/constants/pdf-viewer';
import { getEnvelopeItemPdfUrl } from '@documenso/lib/utils/envelope-download';

import { cn } from '../../lib/utils';
import { useToast } from '../use-toast';

export type LoadedPDFDocument = PDFDocumentProxy;

/**
 * This imports the worker from the `pdfjs-dist` package.
 * Wrapped in typeof window check to prevent SSR evaluation.
 */
if (typeof window !== 'undefined') {
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/legacy/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString();
}

const pdfViewerOptions = {
  cMapUrl: `${NEXT_PUBLIC_WEBAPP_URL()}/static/cmaps/`,
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

const PDFLoader = () => (
  <>
    <Loader className="h-12 w-12 animate-spin text-documenso" />

    <p className="mt-4 text-muted-foreground">
      <Trans>Loading document...</Trans>
    </p>
  </>
);

export type PDFViewerProps = {
  className?: string;
  envelopeItem: Pick<EnvelopeItem, 'id' | 'envelopeId'>;
  token: string | undefined;
  presignToken?: string | undefined;
  version: 'original' | 'signed';
  onDocumentLoad?: (_doc: LoadedPDFDocument) => void;
  onPageClick?: OnPDFViewerPageClick;
  overrideData?: string;
  customPageRenderer?: React.FunctionComponent;
  [key: string]: unknown;
} & Omit<React.HTMLAttributes<HTMLDivElement>, 'onPageClick'>;

export const PDFViewer = ({
  className,
  envelopeItem,
  token,
  presignToken,
  version,
  onDocumentLoad,
  onPageClick,
  overrideData,
  customPageRenderer,
  ...props
}: PDFViewerProps) => {
  const { _ } = useLingui();
  const { toast } = useToast();

  const $el = useRef<HTMLDivElement>(null);

  const [isDocumentBytesLoading, setIsDocumentBytesLoading] = useState(false);
  const [documentBytes, setDocumentBytes] = useState<Uint8Array | null>(
    overrideData ? base64.decode(overrideData) : null,
  );

  const [width, setWidth] = useState(0);
  const [numPages, setNumPages] = useState(0);
  const [pdfError, setPdfError] = useState(false);

  const isLoading = isDocumentBytesLoading || !documentBytes;

  const envelopeItemFile = useMemo(() => {
    if (!documentBytes) {
      return null;
    }

    return {
      data: documentBytes,
    };
  }, [documentBytes]);

  const onDocumentLoaded = (doc: LoadedPDFDocument) => {
    setNumPages(doc.numPages);
    onDocumentLoad?.(doc);
  };

  const onDocumentPageClick = (
    event: React.MouseEvent<HTMLDivElement, MouseEvent>,
    pageNumber: number,
  ) => {
    const $el = event.target instanceof HTMLElement ? event.target : null;

    if (!$el) {
      return;
    }

    const $page = $el.closest(PDF_VIEWER_PAGE_SELECTOR);

    if (!$page) {
      return;
    }

    const { height, width, top, left } = $page.getBoundingClientRect();

    const pageX = event.clientX - left;
    const pageY = event.clientY - top;

    if (onPageClick) {
      void onPageClick({
        pageNumber,
        numPages,
        originalEvent: event,
        pageHeight: height,
        pageWidth: width,
        pageX,
        pageY,
      });
    }
  };

  useEffect(() => {
    if ($el.current) {
      const $current = $el.current;

      const { width } = $current.getBoundingClientRect();

      setWidth(width);

      const onResize = () => {
        const { width } = $current.getBoundingClientRect();

        setWidth(width);
      };

      window.addEventListener('resize', onResize);

      return () => {
        window.removeEventListener('resize', onResize);
      };
    }
  }, []);

  useEffect(() => {
    if (overrideData) {
      const bytes = base64.decode(overrideData);

      setDocumentBytes(bytes);
      return;
    }

    const fetchDocumentBytes = async () => {
      try {
        setIsDocumentBytesLoading(true);

        const documentUrl = getEnvelopeItemPdfUrl({
          type: 'view',
          envelopeItem: envelopeItem,
          token,
          presignToken,
        });

        const bytes = await fetch(documentUrl).then(async (res) => await res.arrayBuffer());

        setDocumentBytes(new Uint8Array(bytes));

        setIsDocumentBytesLoading(false);
      } catch (err) {
        console.error(err);

        toast({
          title: _(msg`Error`),
          description: _(msg`An error occurred while loading the document.`),
          variant: 'destructive',
        });
      }
    };

    void fetchDocumentBytes();
  }, [envelopeItem.envelopeId, envelopeItem.id, token, version, toast, overrideData]);

  return (
    <div ref={$el} className={cn('overflow-hidden', className)} {...props}>
      {isLoading ? (
        <div
          className={cn(
            'flex h-[80vh] max-h-[60rem] w-full flex-col items-center justify-center overflow-hidden rounded',
          )}
        >
          <PDFLoader />
        </div>
      ) : (
        <>
          <PDFDocument
            file={envelopeItemFile}
            className={cn('w-full overflow-hidden rounded', {
              'h-[80vh] max-h-[60rem]': numPages === 0,
            })}
            onLoadSuccess={(d) => onDocumentLoaded(d)}
            // Uploading a invalid document causes an error which doesn't appear to be handled by the `error` prop.
            // Therefore we add some additional custom error handling.
            onSourceError={() => {
              setPdfError(true);
            }}
            externalLinkTarget="_blank"
            loading={
              <div className="flex h-[80vh] max-h-[60rem] flex-col items-center justify-center bg-white/50 dark:bg-background">
                {pdfError ? (
                  <div className="text-center text-muted-foreground">
                    <p>
                      <Trans>Something went wrong while loading the document.</Trans>
                    </p>
                    <p className="mt-1 text-sm">
                      <Trans>Please try again or contact our support.</Trans>
                    </p>
                  </div>
                ) : (
                  <PDFLoader />
                )}
              </div>
            }
            error={
              <div className="flex h-[80vh] max-h-[60rem] flex-col items-center justify-center bg-white/50 dark:bg-background">
                <div className="text-center text-muted-foreground">
                  <p>
                    <Trans>Something went wrong while loading the document.</Trans>
                  </p>
                  <p className="mt-1 text-sm">
                    <Trans>Please try again or contact our support.</Trans>
                  </p>
                </div>
              </div>
            }
            options={pdfViewerOptions}
          >
            {Array(numPages)
              .fill(null)
              .map((_, i) => (
                <div key={i} className="last:-mb-2">
                  <div className="overflow-hidden rounded border border-border will-change-transform">
                    <PDFPage
                      pageNumber={i + 1}
                      width={width}
                      renderAnnotationLayer={false}
                      renderTextLayer={false}
                      loading={() => ''}
                      renderMode={customPageRenderer ? 'custom' : 'canvas'}
                      customRenderer={customPageRenderer}
                      onClick={(e) => onDocumentPageClick(e, i + 1)}
                    />
                  </div>
                  <p className="my-2 text-center text-[11px] text-muted-foreground/80">
                    <Trans>
                      Page {i + 1} of {numPages}
                    </Trans>
                  </p>
                </div>
              ))}
          </PDFDocument>
        </>
      )}
    </div>
  );
};

export default PDFViewer;
