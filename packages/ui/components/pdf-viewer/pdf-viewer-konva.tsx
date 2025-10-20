import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Trans } from '@lingui/react/macro';
import Konva from 'konva';
import { Loader } from 'lucide-react';
import { type PDFDocumentProxy } from 'pdfjs-dist';
import { Document as PDFDocument, Page as PDFPage, pdfjs } from 'react-pdf';

import { useCurrentEnvelopeRender } from '@documenso/lib/client-only/providers/envelope-render-provider';
import { cn } from '@documenso/ui/lib/utils';

export type LoadedPDFDocument = PDFDocumentProxy;

/**
 * This imports the worker from the `pdfjs-dist` package.
 */
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.js',
  import.meta.url,
).toString();

const PDFLoader = () => (
  <>
    <Loader className="text-documenso h-12 w-12 animate-spin" />

    <p className="text-muted-foreground mt-4">
      <Trans>Loading document...</Trans>
    </p>
  </>
);

export type PdfViewerKonvaProps = {
  className?: string;
  onDocumentLoad?: () => void;
  customPageRenderer?: React.FunctionComponent;
  [key: string]: unknown;
} & Omit<React.HTMLAttributes<HTMLDivElement>, 'onPageClick'>;

export const PdfViewerKonva = ({
  className,
  onDocumentLoad,
  customPageRenderer,
  ...props
}: PdfViewerKonvaProps) => {
  const $el = useRef<HTMLDivElement>(null);

  const { getPdfBuffer, currentEnvelopeItem } = useCurrentEnvelopeRender();

  const [width, setWidth] = useState(0);
  const [numPages, setNumPages] = useState(0);
  const [pdfError, setPdfError] = useState(false);

  const envelopeItemFile = useMemo(() => {
    const data = getPdfBuffer(currentEnvelopeItem?.documentDataId || '');

    if (!data || data.status !== 'loaded') {
      return null;
    }

    return {
      data: new Uint8Array(data.file),
    };
  }, [currentEnvelopeItem?.documentDataId, getPdfBuffer]);

  const onDocumentLoaded = useCallback(
    (doc: PDFDocumentProxy) => {
      setNumPages(doc.numPages);
    },
    [onDocumentLoad],
  );

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

  return (
    <div ref={$el} className={cn('w-[800px] overflow-hidden', className)} {...props}>
      {envelopeItemFile && Konva ? (
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
            <div className="dark:bg-background flex h-[80vh] max-h-[60rem] flex-col items-center justify-center bg-white/50">
              {pdfError ? (
                <div className="text-muted-foreground text-center">
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
            <div className="dark:bg-background flex h-[80vh] max-h-[60rem] flex-col items-center justify-center bg-white/50">
              <div className="text-muted-foreground text-center">
                <p>
                  <Trans>Something went wrong while loading the document.</Trans>
                </p>
                <p className="mt-1 text-sm">
                  <Trans>Please try again or contact our support.</Trans>
                </p>
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
                    renderMode={customPageRenderer ? 'custom' : 'canvas'}
                    customRenderer={customPageRenderer}
                  />
                </div>
                <p className="text-muted-foreground/80 my-2 text-center text-[11px]">
                  <Trans>
                    Page {i + 1} of {numPages}
                  </Trans>
                </p>
              </div>
            ))}
        </PDFDocument>
      ) : (
        <div
          className={cn(
            'flex h-[80vh] max-h-[60rem] w-full flex-col items-center justify-center overflow-hidden rounded',
          )}
        >
          <PDFLoader />
        </div>
      )}
    </div>
  );
};

export default PdfViewerKonva;
