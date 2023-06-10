'use client';

import dynamic from 'next/dynamic';

import { Loader } from 'lucide-react';

import { Card, CardContent } from '@documenso/ui/primitives/card';

import { PDFViewerProps } from '~/components/(dashboard)/pdf-viewer/pdf-viewer';

export type LoadablePDFCard = PDFViewerProps & {
  className?: string;
  pdfClassName?: string;
};

const PDFViewer = dynamic(async () => import('~/components/(dashboard)/pdf-viewer/pdf-viewer'), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[80vh] flex-col items-center justify-center bg-white/50">
      <Loader className="h-12 w-12 animate-spin text-slate-500" />

      <p className="mt-4 text-slate-500">Loading document...</p>
    </div>
  ),
});

export const LoadablePDFCard = ({ className, pdfClassName, ...props }: LoadablePDFCard) => {
  return (
    <Card className={className} gradient {...props}>
      <CardContent className="p-2">
        <PDFViewer className={pdfClassName} {...props} />
      </CardContent>
    </Card>
  );
};
