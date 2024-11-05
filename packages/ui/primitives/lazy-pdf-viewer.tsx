'use client';

import dynamic from 'next/dynamic';

import { Trans } from '@lingui/macro';
import { Loader } from 'lucide-react';

export const LazyPDFViewer = dynamic(async () => import('./pdf-viewer'), {
  ssr: false,
  loading: () => (
    <div className="dark:bg-background flex h-[80vh] max-h-[60rem] flex-col items-center justify-center bg-white/50">
      <Loader className="text-documenso h-12 w-12 animate-spin" />

      <p className="text-muted-foreground mt-4">
        <Trans>Loading document...</Trans>
      </p>
    </div>
  ),
});

/**
 * LazyPDFViewer variant with no loader.
 */
export const LazyPDFViewerNoLoader = dynamic(async () => import('./pdf-viewer'), {
  ssr: false,
});
