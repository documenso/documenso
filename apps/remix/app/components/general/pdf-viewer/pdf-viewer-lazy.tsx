/**
 * We need to double wrap the PDFViewer to avoid the following errors:
 *
 * 1. Lazy prevents the pdfjs worker from being bundled
 * 2. onMount guard prevents "Worker not defined"
 */
import { Suspense, lazy, useEffect, useState } from 'react';

import { cn } from '@documenso/ui/lib/utils';

import type { PDFViewerProps } from './pdf-viewer';
import { PdfViewerLoadingState } from './pdf-viewer-states';

const PDFViewer = lazy(async () => import('./pdf-viewer'));

export default function PDFViewerLazy(props: PDFViewerProps) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const fallback = (
    <div className={cn('h-full w-full', props.className)}>
      <PdfViewerLoadingState />
    </div>
  );

  if (!isClient) {
    return fallback;
  }

  return <Suspense fallback={fallback}>{PDFViewer && <PDFViewer {...props} />}</Suspense>;
}
