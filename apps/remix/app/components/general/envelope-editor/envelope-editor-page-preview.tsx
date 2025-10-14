import { lazy, useEffect, useState } from 'react';

import { Trans } from '@lingui/react/macro';
import { FileTextIcon } from 'lucide-react';

import { useCurrentEnvelopeEditor } from '@documenso/lib/client-only/providers/envelope-editor-provider';
import { useCurrentEnvelopeRender } from '@documenso/lib/client-only/providers/envelope-render-provider';
import { AnimateGenericFadeInOut } from '@documenso/ui/components/animate/animate-generic-fade-in-out';
import PDFViewerKonvaLazy from '@documenso/ui/components/pdf-viewer/pdf-viewer-konva-lazy';
import { Alert, AlertDescription, AlertTitle } from '@documenso/ui/primitives/alert';
import { RecipientSelector } from '@documenso/ui/primitives/recipient-selector';
import { Separator } from '@documenso/ui/primitives/separator';

import { EnvelopeRendererFileSelector } from './envelope-file-selector';

const EnvelopeEditorPagePreviewRenderer = lazy(
  async () => import('./envelope-editor-page-preview-renderer'),
);

export const EnvelopeEditorPagePreview = () => {
  const { envelope, editorFields } = useCurrentEnvelopeEditor();

  const { currentEnvelopeItem } = useCurrentEnvelopeRender();

  const [selectedPreviewMode, setSelectedPreviewMode] = useState<'recipient' | 'signed'>(
    'recipient',
  );

  /**
   * Set the selected recipient to the first recipient in the envelope.
   */
  useEffect(() => {
    editorFields.setSelectedRecipient(envelope.recipients[0]?.id ?? null);
  }, []);

  return (
    <div className="relative flex h-full">
      <div className="flex w-full flex-col">
        {/* Horizontal envelope item selector */}
        <EnvelopeRendererFileSelector fields={editorFields.localFields} />

        {/* Document View */}
        <div className="mt-4 flex flex-col items-center justify-center">
          <Alert variant="warning" className="mb-4 max-w-[800px]">
            <AlertTitle>
              <Trans>Preview Mode</Trans>
            </AlertTitle>
            <AlertDescription>
              <Trans>Preview what the signed document will look like with placeholder data</Trans>
            </AlertDescription>
          </Alert>

          {currentEnvelopeItem !== null ? (
            <PDFViewerKonvaLazy customPageRenderer={EnvelopeEditorPagePreviewRenderer} />
          ) : (
            <div className="flex flex-col items-center justify-center py-32">
              <FileTextIcon className="text-muted-foreground h-10 w-10" />
              <p className="text-foreground mt-1 text-sm">
                <Trans>No documents found</Trans>
              </p>
              <p className="text-muted-foreground mt-1 text-sm">
                <Trans>Please upload a document to continue</Trans>
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Right Section - Form Fields Panel */}
      {currentEnvelopeItem && false && (
        <div className="sticky top-0 h-[calc(100vh-73px)] w-80 flex-shrink-0 overflow-y-auto border-l border-gray-200 bg-white py-4">
          {/* Add fields section. */}
          <section className="px-4">
            {/* <h3 className="mb-2 text-sm font-semibold text-gray-900">
              <Trans>Preivew Mode</Trans>
            </h3> */}

            <Alert variant="neutral">
              <AlertTitle>
                <Trans>Preview Mode</Trans>
              </AlertTitle>
              <AlertDescription>
                <Trans>Preview what the signed document will look like with placeholder data</Trans>
              </AlertDescription>
            </Alert>

            {/* <Alert variant="neutral">
              <RadioGroup
                className="gap-y-1"
                value={selectedPreviewMode}
                onValueChange={(value) => setSelectedPreviewMode(value as 'recipient' | 'signed')}
              >
                <div className="flex items-center">
                  <RadioGroupItem
                    id="document-signed-preview"
                    className="pointer-events-none h-3 w-3"
                    value="signed"
                  />
                  <Label
                    htmlFor="document-signed-preview"
                    className="text-foreground ml-1.5 text-xs font-normal"
                  >
                    <Trans>Document Signed Preview</Trans>
                  </Label>
                </div>

                <div className="flex items-center">
                  <RadioGroupItem
                    id="recipient-preview"
                    className="pointer-events-none h-3 w-3"
                    value="recipient"
                  />
                  <Label
                    htmlFor="recipient-preview"
                    className="text-foreground ml-1.5 text-xs font-normal"
                  >
                    <Trans>Recipient Preview</Trans>
                  </Label>
                </div>
              </RadioGroup>
            </Alert>

            <div>Preview what a recipient will see</div>

            <div>Preview the signed document</div> */}
          </section>

          {false && (
            <AnimateGenericFadeInOut key={selectedPreviewMode}>
              {selectedPreviewMode === 'recipient' && (
                <>
                  <Separator className="my-4" />

                  {/* Recipient selector section. */}
                  <section className="px-4">
                    <h3 className="mb-2 text-sm font-semibold text-gray-900">
                      <Trans>Selected Recipient</Trans>
                    </h3>

                    <RecipientSelector
                      selectedRecipient={editorFields.selectedRecipient}
                      onSelectedRecipientChange={(recipient) =>
                        editorFields.setSelectedRecipient(recipient.id)
                      }
                      recipients={envelope.recipients}
                      className="w-full"
                      align="end"
                    />
                  </section>
                </>
              )}
            </AnimateGenericFadeInOut>
          )}
        </div>
      )}
    </div>
  );
};
