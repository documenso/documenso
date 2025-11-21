import { Suspense, lazy } from 'react';

import { type PDFViewerProps } from './pdf-viewer';

const PDFViewer = lazy(async () => import('./pdf-viewer'));

export const PDFViewerSuspense = (props: PDFViewerProps) => {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <PDFViewer {...props} />
    </Suspense>
  );
};
