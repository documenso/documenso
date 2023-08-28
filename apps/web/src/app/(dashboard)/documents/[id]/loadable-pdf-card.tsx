'use client';

import { Card, CardContent } from '@documenso/ui/primitives/card';
import { LazyPDFViewer } from '@documenso/ui/primitives/lazy-pdf-viewer';
import { PDFViewerProps } from '@documenso/ui/primitives/pdf-viewer';

export type LoadablePDFCardType = PDFViewerProps & {
  className?: string;
  pdfClassName?: string;
};

export const LoadablePDFCard = ({ className, pdfClassName, ...props }: LoadablePDFCardType) => {
  return (
    <Card className={className} gradient {...props}>
      <CardContent className="p-2">
        <LazyPDFViewer className={pdfClassName} {...props} />
      </CardContent>
    </Card>
  );
};
