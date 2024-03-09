'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';

import { Loader } from 'lucide-react';
import { type PDFDocumentProxy, PasswordResponses } from 'pdfjs-dist';
import { Document as PDFDocument, Page as PDFPage, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import { match } from 'ts-pattern';

import { PDF_VIEWER_PAGE_SELECTOR } from '@documenso/lib/constants/pdf-viewer';
import { getFile } from '@documenso/lib/universal/upload/get-file';
import type { DocumentData } from '@documenso/prisma/client';
import type { DocumentWithData } from '@documenso/prisma/types/document-with-data';

import { cn } from '../lib/utils';
import { PasswordDialog } from './document-password-dialog';
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
  document?: DocumentWithData;
  password?: string | null;
  onPasswordSubmit?: (password: string) => void | Promise<void>;
  onDocumentLoad?: (_doc: LoadedPDFDocument) => void;
  onPageClick?: OnPDFViewerPageClick;
  [key: string]: unknown;
} & Omit<React.HTMLAttributes<HTMLDivElement>, 'onPageClick'>;

export const PDFViewer = ({
  className,
  documentData,
  password: defaultPassword,
  onPasswordSubmit,
  onDocumentLoad,
  onPageClick,
  ...props
}: PDFViewerProps) => {
  const { toast } = useToast();

  const $el = useRef<HTMLDivElement>(null);

  const passwordCallbackRef = useRef<((password: string | null) => void) | null>(null);

  const [isDocumentBytesLoading, setIsDocumentBytesLoading] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isPasswordError, setIsPasswordError] = useState(false);
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
        <>
          <PDFDocument
            file={documentBytes.buffer}
            className={cn('w-full overflow-hidden rounded', {
              'h-[80vh] max-h-[60rem]': numPages === 0,
            })}
            onPassword={(callback, reason) => {
              // If the document already has a password, we don't need to ask for it again.
              if (defaultPassword && reason !== PasswordResponses.INCORRECT_PASSWORD) {
                callback(defaultPassword);
                return;
              }

              setIsPasswordModalOpen(true);

              passwordCallbackRef.current = callback;

              match(reason)
                .with(PasswordResponses.NEED_PASSWORD, () => setIsPasswordError(false))
                .with(PasswordResponses.INCORRECT_PASSWORD, () => setIsPasswordError(true));
            }}
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
                <div key={i} className="last:-mb-2">
                  <div className="border-border overflow-hidden rounded border will-change-transform">
                    <PDFPage
                      pageNumber={i + 1}
                      width={width}
                      renderAnnotationLayer={false}
                      renderTextLayer={false}
                      loading={() => ''}
                      onClick={(e) => onDocumentPageClick(e, i + 1)}
                    />
                  </div>
                  <p className="text-muted-foreground/80 my-2 text-center text-[11px]">
                    Page {i + 1} of {numPages}
                  </p>
                </div>
              ))}
          </PDFDocument>

          <PasswordDialog
            open={isPasswordModalOpen}
            onOpenChange={setIsPasswordModalOpen}
            onPasswordSubmit={(password) => {
              passwordCallbackRef.current?.(password);

              setIsPasswordModalOpen(false);

              void onPasswordSubmit?.(password);
            }}
            isError={isPasswordError}
          />
        </>
      )}
    </div>
  );
};

export default PDFViewer;
