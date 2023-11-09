'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';

import { Loader } from 'lucide-react';
import { PDFDocumentProxy } from 'pdfjs-dist';
import { Document as PDFDocument, Page as PDFPage, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

import { PDF_VIEWER_PAGE_SELECTOR } from '@documenso/lib/constants/pdf-viewer';
import { getFile } from '@documenso/lib/universal/upload/get-file';
import { DocumentData } from '@documenso/prisma/client';
import { cn } from '@documenso/ui/lib/utils';

import { useToast } from './use-toast';

export type LoadedPDFDocument = PDFDocumentProxy;

/**
 * This imports the worker from the `pdfjs-dist` package.
 */
pdfjs.GlobalWorkerOptions.workerSrc = `/pdf.worker.min.js`;

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
    <Loader className="text-documenso h-12 w-12 animate-spin" />

    <p className="text-muted-foreground mt-4">Loading document...</p>
  </>
);

export type PDFViewerProps = {
  className?: string;
  documentData: DocumentData;
  onDocumentLoad?: (_doc: LoadedPDFDocument) => void;
  onPageClick?: OnPDFViewerPageClick;
  [key: string]: unknown;
} & Omit<React.HTMLAttributes<HTMLDivElement>, 'onPageClick'>;

export const PDFViewer = ({
  className,
  documentData,
  onDocumentLoad,
  onPageClick,
  ...props
}: PDFViewerProps) => {
  const { toast } = useToast();

  const $el = useRef<HTMLDivElement>(null);

  const [isDocumentBytesLoading, setIsDocumentBytesLoading] = useState(false);
  const [documentBytes, setDocumentBytes] = useState<Uint8Array | null>(null);

  const [width, setWidth] = useState(0);
  const [numPages, setNumPages] = useState(0);
  const [pdfError, setPdfError] = useState(false);

  const memoizedData = useMemo(
    () => ({ type: documentData.type, data: documentData.data }),
    [documentData.data, documentData.type],
  );

  const isLoading = isDocumentBytesLoading || !documentBytes;

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
    const fetchDocumentBytes = async () => {
      try {
        setIsDocumentBytesLoading(true);

        const bytes = await getFile(memoizedData);

        setDocumentBytes(bytes);

        setIsDocumentBytesLoading(false);
      } catch (err) {
        console.error(err);

        toast({
          title: 'Error',
          description: 'An error occurred while loading the document.',
          variant: 'destructive',
        });
      }
    };

    void fetchDocumentBytes();
  }, [memoizedData, toast]);

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
        <PDFDocument
          file={documentBytes.buffer}
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
            <div className="dark:bg-background flex h-[80vh] max-h-[60rem] flex-col items-center justify-center bg-white/50">
              {pdfError ? (
                <div className="text-muted-foreground text-center">
                  <p>Something went wrong while loading the document.</p>
                  <p className="mt-1 text-sm">Please try again or contact our support.</p>
                </div>
              ) : (
                <PDFLoader />
              )}
            </div>
          }
          error={
            <div className="dark:bg-background flex h-[80vh] max-h-[60rem] flex-col items-center justify-center bg-white/50">
              <div className="text-muted-foreground text-center">
                <p>Something went wrong while loading the document.</p>
                <p className="mt-1 text-sm">Please try again or contact our support.</p>
              </div>
            </div>
          }
        >
          {Array(numPages)
            .fill(null)
            .map((_, i) => (
              <div
                key={i}
                className="border-border my-8 overflow-hidden rounded border first:mt-0 last:mb-0"
              >
                <PDFPage
                  pageNumber={i + 1}
                  width={width}
                  renderAnnotationLayer={false}
                  renderTextLayer={false}
                  loading={() => ''}
                  onClick={(e) => onDocumentPageClick(e, i + 1)}
                />
              </div>
            ))}
        </PDFDocument>
      )}
    </div>
  );
};

export default PDFViewer;
