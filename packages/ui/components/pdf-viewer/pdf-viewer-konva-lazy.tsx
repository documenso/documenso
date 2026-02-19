import React, { Suspense, lazy } from 'react';

import { Trans } from '@lingui/react/macro';
import { type PDFDocumentProxy } from 'pdfjs-dist';

import type { PdfViewerRendererMode } from './pdf-viewer-konva';

export type LoadedPDFDocument = PDFDocumentProxy;

export type PDFViewerProps = {
  className?: string;
  onDocumentLoad?: () => void;
  renderer: PdfViewerRendererMode;
  [key: string]: unknown;
} & Omit<React.HTMLAttributes<HTMLDivElement>, 'onPageClick'>;

const EnvelopePdfViewer = lazy(async () => import('./pdf-viewer-konva'));

export const PDFViewerKonvaLazy = (props: PDFViewerProps) => {
  return (
    <Suspense
      fallback={
        <div>
          <Trans>Loading...</Trans>
        </div>
      }
    >
      <EnvelopePdfViewer {...props} />
    </Suspense>
  );
};

export default PDFViewerKonvaLazy;
