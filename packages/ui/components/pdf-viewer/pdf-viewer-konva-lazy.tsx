import React, { Suspense, lazy } from 'react';

import { type PDFDocumentProxy } from 'pdfjs-dist';

export type LoadedPDFDocument = PDFDocumentProxy;

export type PDFViewerProps = {
  className?: string;
  onDocumentLoad?: () => void;
  [key: string]: unknown;
} & Omit<React.HTMLAttributes<HTMLDivElement>, 'onPageClick'>;

const EnvelopePdfViewer = lazy(async () => import('./pdf-viewer-konva'));

export const PDFViewerKonvaLazy = (props: PDFViewerProps) => {
  return (
    <Suspense fallback={<div>Loading client component...</div>}>
      <EnvelopePdfViewer {...props} />
    </Suspense>
  );
};

export default PDFViewerKonvaLazy;
