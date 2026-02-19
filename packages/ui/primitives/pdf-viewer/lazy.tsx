import { ClientOnly } from '../../components/client-only';

import { Trans } from '@lingui/react/macro';

import { PDFViewer, type PDFViewerProps } from './base.client';

export const PDFViewerLazy = (props: PDFViewerProps) => {
  return (
    <ClientOnly
      fallback={
        <div>
          <Trans>Loading...</Trans>
        </div>
      }
    >
      {() => <PDFViewer {...props} />}
    </ClientOnly>
  );
};
