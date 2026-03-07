import React, { useRef } from 'react';

import type { MessageDescriptor } from '@lingui/core';
import { Trans, useLingui } from '@lingui/react/macro';

import { useCurrentEnvelopeRender } from '@documenso/lib/client-only/providers/envelope-render-provider';
import { PDF_VIEWER_ERROR_MESSAGES } from '@documenso/lib/constants/pdf-viewer-i18n';
import { cn } from '@documenso/ui/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@documenso/ui/primitives/alert';

import type { PDFViewerProps } from './pdf-viewer';
import PDFViewerLazy from './pdf-viewer-lazy';

export type EnvelopePdfViewerProps = {
  /**
   * The error message to render when there is an error.
   */
  errorMessage: { title: MessageDescriptor; description: MessageDescriptor } | null;
} & Omit<PDFViewerProps, 'data'>;

export const EnvelopePdfViewer = ({
  errorMessage,
  className,
  ...props
}: EnvelopePdfViewerProps) => {
  const { t } = useLingui();

  const $el = useRef<HTMLDivElement>(null);

  const { currentEnvelopeItem, renderError } = useCurrentEnvelopeRender();

  if (renderError || !currentEnvelopeItem) {
    return (
      <div ref={$el} className={cn('h-full w-full max-w-[800px]', className)} {...props}>
        {renderError ? (
          <Alert variant="destructive" className="mb-4 max-w-[800px]">
            <AlertTitle>
              {t(errorMessage?.title || PDF_VIEWER_ERROR_MESSAGES.default.title)}
            </AlertTitle>
            <AlertDescription>
              {t(errorMessage?.description || PDF_VIEWER_ERROR_MESSAGES.default.description)}
            </AlertDescription>
          </Alert>
        ) : (
          <div className="flex h-[80vh] max-h-[60rem] w-full flex-col items-center justify-center overflow-hidden rounded">
            <p className="text-sm text-muted-foreground">
              <Trans>No document found</Trans>
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <PDFViewerLazy
      key={`${currentEnvelopeItem.envelopeId}-${currentEnvelopeItem.id}`}
      {...props}
      className={cn('h-full w-full max-w-[800px]', className)}
      data={currentEnvelopeItem.data}
    />
  );
};

export default EnvelopePdfViewer;
