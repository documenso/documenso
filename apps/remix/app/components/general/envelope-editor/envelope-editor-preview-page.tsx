import { lazy, useEffect, useMemo, useState } from 'react';

import { faker } from '@faker-js/faker/locale/en';
import { Trans } from '@lingui/react/macro';
import { FieldType, SigningStatus } from '@prisma/client';
import { FileTextIcon } from 'lucide-react';
import { match } from 'ts-pattern';

import { useCurrentEnvelopeEditor } from '@documenso/lib/client-only/providers/envelope-editor-provider';
import {
  EnvelopeRenderProvider,
  useCurrentEnvelopeRender,
} from '@documenso/lib/client-only/providers/envelope-render-provider';
import { ZFieldAndMetaSchema } from '@documenso/lib/types/field-meta';
import { extractFieldInsertionValues } from '@documenso/lib/utils/envelope-signing';
import { toCheckboxCustomText } from '@documenso/lib/utils/fields';
import { extractInitials } from '@documenso/lib/utils/recipient-formatter';
import { AnimateGenericFadeInOut } from '@documenso/ui/components/animate/animate-generic-fade-in-out';
import PDFViewerKonvaLazy from '@documenso/ui/components/pdf-viewer/pdf-viewer-konva-lazy';
import { Alert, AlertDescription, AlertTitle } from '@documenso/ui/primitives/alert';
import { RecipientSelector } from '@documenso/ui/primitives/recipient-selector';
import { Separator } from '@documenso/ui/primitives/separator';

import { EnvelopeRendererFileSelector } from './envelope-file-selector';

const EnvelopeGenericPageRenderer = lazy(
  async () => import('~/components/general/envelope-editor/envelope-generic-page-renderer'),
);

// Todo: Envelopes - Dynamically import faker
export const EnvelopeEditorPreviewPage = () => {
  const { envelope, editorFields } = useCurrentEnvelopeEditor();

  const { currentEnvelopeItem, fields } = useCurrentEnvelopeRender();

  const [selectedPreviewMode, setSelectedPreviewMode] = useState<'recipient' | 'signed'>(
    'recipient',
  );

  const fieldsWithPlaceholders = useMemo(() => {
    return fields.map((field) => {
      const fieldMeta = ZFieldAndMetaSchema.parse(field);

      const recipient = envelope.recipients.find((recipient) => recipient.id === field.recipientId);

      if (!recipient) {
        throw new Error('Recipient not found');
      }

      faker.seed(recipient.id);

      const recipientName = recipient.name || faker.person.fullName();
      const recipientEmail = recipient.email || faker.internet.email();

      faker.seed(recipient.id + field.id);

      return {
        ...field,
        inserted: true,
        ...match(fieldMeta)
          .with({ type: FieldType.TEXT }, ({ fieldMeta }) => {
            let text = fieldMeta?.text || faker.lorem.words(5);

            if (fieldMeta?.characterLimit) {
              text = text.slice(0, fieldMeta?.characterLimit);
            }

            return {
              customText: text,
            };
          })
          .with({ type: FieldType.NUMBER }, ({ fieldMeta }) => {
            let number = fieldMeta?.value ?? '';

            if (number === '') {
              number = faker.number
                .int({
                  min: fieldMeta?.minValue ?? 0,
                  max: fieldMeta?.maxValue ?? 1000,
                })
                .toString();
            }

            return {
              customText: number,
            };
          })
          .with({ type: FieldType.DATE }, () => {
            const date = extractFieldInsertionValues({
              fieldValue: {
                type: FieldType.DATE,
                value: true,
              },
              field,
              documentMeta: envelope.documentMeta,
            });

            return {
              customText: date.customText,
            };
          })
          .with({ type: FieldType.EMAIL }, () => {
            return {
              customText: recipientEmail,
            };
          })
          .with({ type: FieldType.NAME }, () => {
            return {
              customText: recipientName,
            };
          })
          .with({ type: FieldType.INITIALS }, () => {
            return {
              customText: extractInitials(recipientName),
            };
          })
          .with({ type: FieldType.RADIO }, ({ fieldMeta }) => {
            const values = fieldMeta?.values ?? [];

            if (values.length === 0) {
              return '';
            }

            let customText = '';

            const preselectedValue = values.findIndex((value) => value.checked);

            if (preselectedValue !== -1) {
              customText = preselectedValue.toString();
            } else {
              const randomIndex = faker.number.int({ min: 0, max: values.length - 1 });
              customText = randomIndex.toString();
            }

            return {
              customText,
            };
          })
          .with({ type: FieldType.CHECKBOX }, ({ fieldMeta }) => {
            let checkedValues: number[] = [];

            const values = fieldMeta?.values ?? [];

            values.forEach((value, index) => {
              if (value.checked) {
                checkedValues.push(index);
              }
            });

            if (checkedValues.length === 0 && values.length > 0) {
              const numberOfValues = fieldMeta?.validationLength || 1;

              checkedValues = Array.from({ length: numberOfValues }, (_, index) => index);
            }

            return {
              customText: toCheckboxCustomText(checkedValues),
            };
          })
          .with({ type: FieldType.DROPDOWN }, ({ fieldMeta }) => {
            const values = fieldMeta?.values ?? [];

            let customText = fieldMeta?.defaultValue || '';

            if (!customText && values.length > 0) {
              const randomIndex = faker.number.int({ min: 0, max: values.length - 1 });
              customText = values[randomIndex].value;
            }

            return {
              customText,
            };
          })
          .with({ type: FieldType.SIGNATURE }, () => {
            return {
              customText: '',
              signature: {
                signatureImageAsBase64: '',
                typedSignature: recipientName,
              },
            };
          })
          .with({ type: FieldType.FREE_SIGNATURE }, () => {
            return {
              customText: '',
            };
          })
          .exhaustive(),
      };
    });
  }, [fields, envelope, envelope.recipients, envelope.documentMeta]);

  /**
   * Set the selected recipient to the first recipient in the envelope.
   */
  useEffect(() => {
    editorFields.setSelectedRecipient(envelope.recipients[0]?.id ?? null);
  }, []);

  // Override the parent renderer provider so we can inject custom fields.
  return (
    <EnvelopeRenderProvider
      envelope={envelope}
      token={undefined}
      fields={fieldsWithPlaceholders}
      recipients={envelope.recipients.map((recipient) => ({
        ...recipient,
        signingStatus: SigningStatus.SIGNED,
      }))}
      overrideSettings={{
        mode: 'export',
      }}
    >
      <div className="relative flex h-full">
        <div className="flex w-full flex-col overflow-y-auto">
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
              <PDFViewerKonvaLazy
                renderer="editor"
                customPageRenderer={EnvelopeGenericPageRenderer}
              />
            ) : (
              <div className="flex flex-col items-center justify-center py-32">
                <FileTextIcon className="h-10 w-10 text-muted-foreground" />
                <p className="mt-1 text-sm text-foreground">
                  <Trans>No documents found</Trans>
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  <Trans>Please upload a document to continue</Trans>
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right Section - Form Fields Panel */}
        {currentEnvelopeItem && false && (
          <div className="sticky top-0 h-full w-80 flex-shrink-0 overflow-y-auto border-l border-gray-200 bg-white py-4">
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
                  <Trans>
                    Preview what the signed document will look like with placeholder data
                  </Trans>
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
    </EnvelopeRenderProvider>
  );
};
