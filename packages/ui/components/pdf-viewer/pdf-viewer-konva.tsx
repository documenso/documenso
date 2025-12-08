import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { MessageDescriptor } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { Trans, useLingui } from '@lingui/react/macro';
import Konva from 'konva';
import { Loader } from 'lucide-react';
import { type PDFDocumentProxy } from 'pdfjs-dist';
import { Document as PDFDocument, Page as PDFPage, pdfjs } from 'react-pdf';

import { useCurrentEnvelopeRender } from '@documenso/lib/client-only/providers/envelope-render-provider';
import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { cn } from '@documenso/ui/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@documenso/ui/primitives/alert';

export type LoadedPDFDocument = PDFDocumentProxy;

/**
 * This imports the worker from the `pdfjs-dist` package.
 */
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/legacy/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

const pdfViewerOptions = {
  cMapUrl: `${NEXT_PUBLIC_WEBAPP_URL()}/static/cmaps/`,
};

const PDFLoader = () => (
  <>
    <Loader className="h-12 w-12 animate-spin text-documenso" />

    <p className="mt-4 text-muted-foreground">
      <Trans>Loading document...</Trans>
    </p>
  </>
);

export type PdfViewerRendererMode = 'editor' | 'preview' | 'signing';

const RendererErrorMessages: Record<
  PdfViewerRendererMode,
  { title: MessageDescriptor; description: MessageDescriptor }
> = {
  editor: {
    title: msg`Configuration Error`,
    description: msg`There was an issue rendering some fields, please review the fields and try again.`,
  },
  preview: {
    title: msg`Configuration Error`,
    description: msg`Something went wrong while rendering the document, some fields may be missing or corrupted.`,
  },
  signing: {
    title: msg`Configuration Error`,
    description: msg`Something went wrong while rendering the document, some fields may be missing or corrupted.`,
  },
};

export type PdfViewerKonvaProps = {
  className?: string;
  onDocumentLoad?: () => void;
  customPageRenderer?: React.FunctionComponent;
  renderer: PdfViewerRendererMode;
  [key: string]: unknown;
} & Omit<React.HTMLAttributes<HTMLDivElement>, 'onPageClick'>;

export const PdfViewerKonva = ({
  className,
  onDocumentLoad,
  customPageRenderer,
  renderer,
  ...props
}: PdfViewerKonvaProps) => {
  const { t } = useLingui();

  const $el = useRef<HTMLDivElement>(null);

  const { getPdfBuffer, currentEnvelopeItem, renderError } = useCurrentEnvelopeRender();

  const [width, setWidth] = useState(0);
  const [numPages, setNumPages] = useState(0);
  const [pdfError, setPdfError] = useState(false);

  const envelopeItemFile = useMemo(() => {
    const data = getPdfBuffer(currentEnvelopeItem?.id || '');

    if (!data || data.status !== 'loaded') {
      return null;
    }

    return {
      data: new Uint8Array(data.file),
    };
  }, [currentEnvelopeItem?.id, getPdfBuffer]);

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
    <div ref={$el} className={cn('w-full max-w-[800px]', className)} {...props}>
      {renderError && (
        <Alert variant="destructive" className="mb-4 max-w-[800px]">
          <AlertTitle>{t(RendererErrorMessages[renderer].title)}</AlertTitle>
          <AlertDescription>{t(RendererErrorMessages[renderer].description)}</AlertDescription>
        </Alert>
      )}

      {envelopeItemFile && Konva ? (
        <PDFDocument
          file={envelopeItemFile}
          className={cn('w-full rounded', {
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
                <div className="rounded border border-border will-change-transform">
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
                <p className="my-2 text-center text-[11px] text-muted-foreground/80">
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
