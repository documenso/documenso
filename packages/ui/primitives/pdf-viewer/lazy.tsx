import { ClientOnly } from '../../components/client-only';

import { PDFViewer, type PDFViewerProps } from './base.client';

export const PDFViewerLazy = (props: PDFViewerProps) => {
  return <ClientOnly fallback={<div>Loading...</div>}>{() => <PDFViewer {...props} />}</ClientOnly>;
};
