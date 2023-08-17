'use client';

import dynamic from 'next/dynamic';

import { Loader } from 'lucide-react';

export const LazyPDFViewer = dynamic(
  async () => import('~/components/(dashboard)/pdf-viewer/pdf-viewer'),
  {
    ssr: false,
    loading: () => (
      <div className="dark:bg-background flex min-h-[80vh] flex-col items-center justify-center bg-white/50">
        <Loader className="text-documenso h-12 w-12 animate-spin" />

        <p className="text-muted-foreground mt-4">Loading document...</p>
      </div>
    ),
  },
);
