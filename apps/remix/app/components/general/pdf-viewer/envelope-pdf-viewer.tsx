import { useCurrentEnvelopeRender } from '@documenso/lib/client-only/providers/envelope-render-provider';
import { PDF_VIEWER_ERROR_MESSAGES } from '@documenso/lib/constants/pdf-viewer-i18n';
import { cn } from '@documenso/ui/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@documenso/ui/primitives/alert';
import type { MessageDescriptor } from '@lingui/core';
import { Trans, useLingui } from '@lingui/react/macro';
import { useRef } from 'react';

import type { PDFViewerProps } from './pdf-viewer';
import PDFViewerLazy from './pdf-viewer-lazy';
import type { EnvelopePdfViewerToolbarControl } from './pdf-viewer-toolbar';
import { EnvelopePdfViewerToolbar } from './pdf-viewer-toolbar';

export type EnvelopePdfViewerProps = {
  /**
   * The error message to render when there is an error.
   */
  errorMessage: { title: MessageDescriptor; description: MessageDescriptor } | null;

  /**
   * The controls to display in the floating viewer toolbar.
   *
   * When omitted no toolbar is rendered.
   */
  toolbar?: EnvelopePdfViewerToolbarControl[];

  /**
   * Additional class names for the floating viewer toolbar.
   */
  toolbarClassName?: string;
} & Omit<PDFViewerProps, 'data'>;

export const EnvelopePdfViewer = ({
  errorMessage,
  toolbar,
  toolbarClassName,
  className,
  ...props
}: EnvelopePdfViewerProps) => {
  const { t } = useLingui();

  const $el = useRef<HTMLDivElement>(null);

  const { currentEnvelopeItem, renderError, viewerControls } = useCurrentEnvelopeRender();

  if (renderError || !currentEnvelopeItem) {
    return (
      <div ref={$el} className={cn('h-full w-full max-w-[800px]', className)} {...props}>
        {renderError ? (
          <Alert variant="destructive" className="mb-4 max-w-[800px]">
            <AlertTitle>{t(errorMessage?.title || PDF_VIEWER_ERROR_MESSAGES.default.title)}</AlertTitle>
            <AlertDescription>
              {t(errorMessage?.description || PDF_VIEWER_ERROR_MESSAGES.default.description)}
            </AlertDescription>
          </Alert>
        ) : (
          <div className="flex h-[80vh] max-h-[60rem] w-full flex-col items-center justify-center overflow-hidden rounded">
            <p className="text-muted-foreground text-sm">
              <Trans>No document found</Trans>
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <PDFViewerLazy
        key={`${currentEnvelopeItem.envelopeId}-${currentEnvelopeItem.id}`}
        {...props}
        className={cn('h-full w-full', className)}
        data={currentEnvelopeItem.data}
        zoom={viewerControls.zoom}
        maxPageWidth={800}
      />

      {toolbar && toolbar.length > 0 && (
        <EnvelopePdfViewerToolbar
          controls={toolbar}
          scrollParentRef={props.scrollParentRef}
          className={toolbarClassName}
        />
      )}
    </>
  );
};

export default EnvelopePdfViewer;
