import { lazy, useEffect, useMemo, useState } from 'react';

import type { MessageDescriptor } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { Trans, useLingui } from '@lingui/react/macro';
import { FieldType, RecipientRole } from '@prisma/client';
import { FileTextIcon } from 'lucide-react';
import { Link } from 'react-router';
import { isDeepEqual } from 'remeda';
import { match } from 'ts-pattern';

import { useCurrentEnvelopeEditor } from '@documenso/lib/client-only/providers/envelope-editor-provider';
import { useCurrentEnvelopeRender } from '@documenso/lib/client-only/providers/envelope-render-provider';
import { getPageCanvasRefs } from '@documenso/lib/client-only/utils/page-canvas-registry';
import type { TDetectedFormField } from '@documenso/lib/types/ai';
import type {
  TCheckboxFieldMeta,
  TDateFieldMeta,
  TDropdownFieldMeta,
  TEmailFieldMeta,
  TFieldMetaSchema,
  TInitialsFieldMeta,
  TNameFieldMeta,
  TNumberFieldMeta,
  TRadioFieldMeta,
  TSignatureFieldMeta,
  TTextFieldMeta,
} from '@documenso/lib/types/field-meta';
import { FIELD_META_DEFAULT_VALUES } from '@documenso/lib/types/field-meta';
import { canRecipientFieldsBeModified } from '@documenso/lib/utils/recipients';
import { AnimateGenericFadeInOut } from '@documenso/ui/components/animate/animate-generic-fade-in-out';
import PDFViewerKonvaLazy from '@documenso/ui/components/pdf-viewer/pdf-viewer-konva-lazy';
import { Alert, AlertDescription, AlertTitle } from '@documenso/ui/primitives/alert';
import { Button } from '@documenso/ui/primitives/button';
import { RecipientSelector } from '@documenso/ui/primitives/recipient-selector';
import { Separator } from '@documenso/ui/primitives/separator';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { EditorFieldCheckboxForm } from '~/components/forms/editor/editor-field-checkbox-form';
import { EditorFieldDateForm } from '~/components/forms/editor/editor-field-date-form';
import { EditorFieldDropdownForm } from '~/components/forms/editor/editor-field-dropdown-form';
import { EditorFieldEmailForm } from '~/components/forms/editor/editor-field-email-form';
import { EditorFieldInitialsForm } from '~/components/forms/editor/editor-field-initials-form';
import { EditorFieldNameForm } from '~/components/forms/editor/editor-field-name-form';
import { EditorFieldNumberForm } from '~/components/forms/editor/editor-field-number-form';
import { EditorFieldRadioForm } from '~/components/forms/editor/editor-field-radio-form';
import { EditorFieldSignatureForm } from '~/components/forms/editor/editor-field-signature-form';
import { EditorFieldTextForm } from '~/components/forms/editor/editor-field-text-form';

import { EnvelopeEditorFieldDragDrop } from './envelope-editor-fields-drag-drop';
import { EnvelopeRendererFileSelector } from './envelope-file-selector';

const EnvelopeEditorFieldsPageRenderer = lazy(
  async () => import('./envelope-editor-fields-page-renderer'),
);

// Expands fields to minimum usable dimensions (30px height, 36px width) and centers them
const enforceMinimumFieldDimensions = (params: {
  positionX: number;
  positionY: number;
  width: number;
  height: number;
  pageWidth: number;
  pageHeight: number;
}): {
  positionX: number;
  positionY: number;
  width: number;
  height: number;
} => {
  const MIN_HEIGHT_PX = 30;
  const MIN_WIDTH_PX = 36;

  const widthPx = (params.width / 100) * params.pageWidth;
  const heightPx = (params.height / 100) * params.pageHeight;

  let adjustedWidth = params.width;
  let adjustedHeight = params.height;
  let adjustedPositionX = params.positionX;
  let adjustedPositionY = params.positionY;

  if (widthPx < MIN_WIDTH_PX) {
    const centerXPx = (params.positionX / 100) * params.pageWidth + widthPx / 2;
    adjustedWidth = (MIN_WIDTH_PX / params.pageWidth) * 100;
    adjustedPositionX = ((centerXPx - MIN_WIDTH_PX / 2) / params.pageWidth) * 100;

    if (adjustedPositionX < 0) {
      adjustedPositionX = 0;
    } else if (adjustedPositionX + adjustedWidth > 100) {
      adjustedPositionX = 100 - adjustedWidth;
    }
  }

  if (heightPx < MIN_HEIGHT_PX) {
    const centerYPx = (params.positionY / 100) * params.pageHeight + heightPx / 2;
    adjustedHeight = (MIN_HEIGHT_PX / params.pageHeight) * 100;

    adjustedPositionY = ((centerYPx - MIN_HEIGHT_PX / 2) / params.pageHeight) * 100;

    if (adjustedPositionY < 0) {
      adjustedPositionY = 0;
    } else if (adjustedPositionY + adjustedHeight > 100) {
      adjustedPositionY = 100 - adjustedHeight;
    }
  }

  return {
    positionX: adjustedPositionX,
    positionY: adjustedPositionY,
    width: adjustedWidth,
    height: adjustedHeight,
  };
};

const detectFormFieldsInDocument = async (params: {
  envelopeId: string;
  onProgress: (current: number, total: number) => void;
}): Promise<{
  fieldsPerPage: Map<number, TDetectedFormField[]>;
  errors: Map<number, Error>;
}> => {
  const { envelopeId, onProgress } = params;
  const fieldsPerPage = new Map<number, TDetectedFormField[]>();
  const errors = new Map<number, Error>();

  try {
    onProgress(0, 1);

    const response = await fetch('/api/ai/detect-fields', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ envelopeId }),
      credentials: 'include',
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Field detection failed: ${response.statusText} - ${errorText}`);
    }

    const detectedFields: TDetectedFormField[] = await response.json();

    for (const field of detectedFields) {
      if (!fieldsPerPage.has(field.pageNumber)) {
        fieldsPerPage.set(field.pageNumber, []);
      }
      fieldsPerPage.get(field.pageNumber)!.push(field);
    }

    onProgress(1, 1);
  } catch (error) {
    errors.set(0, error instanceof Error ? error : new Error(String(error)));
  }

  return { fieldsPerPage, errors };
};

const FieldSettingsTypeTranslations: Record<FieldType, MessageDescriptor> = {
  [FieldType.SIGNATURE]: msg`Signature Settings`,
  [FieldType.FREE_SIGNATURE]: msg`Free Signature Settings`,
  [FieldType.TEXT]: msg`Text Settings`,
  [FieldType.DATE]: msg`Date Settings`,
  [FieldType.EMAIL]: msg`Email Settings`,
  [FieldType.NAME]: msg`Name Settings`,
  [FieldType.INITIALS]: msg`Initials Settings`,
  [FieldType.NUMBER]: msg`Number Settings`,
  [FieldType.RADIO]: msg`Radio Settings`,
  [FieldType.CHECKBOX]: msg`Checkbox Settings`,
  [FieldType.DROPDOWN]: msg`Dropdown Settings`,
};

export const EnvelopeEditorFieldsPage = () => {
  const { envelope, editorFields, relativePath } = useCurrentEnvelopeEditor();

  const { currentEnvelopeItem } = useCurrentEnvelopeRender();

  const { t } = useLingui();
  const { toast } = useToast();

  const [isDetectingFields, setIsAutoAddingFields] = useState(false);
  const [processingProgress, setProcessingProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);

  const selectedField = useMemo(
    () => structuredClone(editorFields.selectedField),
    [editorFields.selectedField],
  );

  const updateSelectedFieldMeta = (fieldMeta: TFieldMetaSchema) => {
    if (!selectedField) {
      return;
    }

    const isMetaSame = isDeepEqual(selectedField.fieldMeta, fieldMeta);

    if (!isMetaSame) {
      editorFields.updateFieldByFormId(selectedField.formId, {
        fieldMeta,
      });
    }
  };

  /**
   * Set the selected recipient to the first recipient in the envelope.
   */
  useEffect(() => {
    const firstSelectableRecipient = envelope.recipients.find(
      (recipient) =>
        recipient.role === RecipientRole.SIGNER || recipient.role === RecipientRole.APPROVER,
    );

    editorFields.setSelectedRecipient(firstSelectableRecipient?.id ?? null);
  }, []);

  return (
    <div className="relative flex h-full">
      <div className="relative flex w-full flex-col overflow-y-auto">
        {/* Horizontal envelope item selector */}
        {isDetectingFields && (
          <>
            <div className="edge-glow edge-glow-top pointer-events-none fixed left-0 right-0 top-0 z-20 h-16" />
            <div className="edge-glow edge-glow-right pointer-events-none fixed bottom-0 right-0 top-0 z-20 w-16" />
            <div className="edge-glow edge-glow-bottom pointer-events-none fixed bottom-0 left-0 right-0 z-20 h-16" />
            <div className="edge-glow edge-glow-left pointer-events-none fixed bottom-0 left-0 top-0 z-20 w-16" />
          </>
        )}

        <EnvelopeRendererFileSelector fields={editorFields.localFields} />

        {/* Document View */}
        <div className="mt-4 flex flex-col items-center justify-center">
          {envelope.recipients.length === 0 && (
            <Alert
              variant="neutral"
              className="border-border bg-background mb-4 flex max-w-[800px] flex-row items-center justify-between space-y-0 rounded-sm border"
            >
              <div className="flex flex-col gap-1">
                <AlertTitle>
                  <Trans>Missing Recipients</Trans>
                </AlertTitle>
                <AlertDescription>
                  <Trans>You need at least one recipient to add fields</Trans>
                </AlertDescription>
              </div>

              <Button asChild variant="outline">
                <Link to={`${relativePath.editorPath}`}>
                  <Trans>Add Recipients</Trans>
                </Link>
              </Button>
            </Alert>
          )}

          {currentEnvelopeItem !== null ? (
            <PDFViewerKonvaLazy
              renderer="editor"
              customPageRenderer={EnvelopeEditorFieldsPageRenderer}
            />
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
      {currentEnvelopeItem && envelope.recipients.length > 0 && (
        <div className="bg-background border-border sticky top-0 h-full w-80 flex-shrink-0 overflow-y-auto border-l py-4">
          {/* Recipient selector section. */}
          <section className="px-4">
            <h3 className="text-foreground mb-2 text-sm font-semibold">
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

            {editorFields.selectedRecipient &&
              !canRecipientFieldsBeModified(editorFields.selectedRecipient, envelope.fields) && (
                <Alert className="mt-4" variant="warning">
                  <AlertDescription>
                    <Trans>
                      This recipient can no longer be modified as they have signed a field, or
                      completed the document.
                    </Trans>
                  </AlertDescription>
                </Alert>
              )}
          </section>

          <Separator className="my-4" />

          {/* Add fields section. */}
          <section className="px-4">
            <h3 className="text-foreground mb-2 text-sm font-semibold">
              <Trans>Add Fields</Trans>
            </h3>

            <EnvelopeEditorFieldDragDrop
              selectedRecipientId={editorFields.selectedRecipient?.id ?? null}
              selectedEnvelopeItemId={currentEnvelopeItem?.id ?? null}
            />

            <Button
              className="mt-4 w-full"
              variant="outline"
              disabled={isDetectingFields}
              onClick={async () => {
                setIsAutoAddingFields(true);
                setProcessingProgress(null);

                try {
                  if (!currentEnvelopeItem) {
                    toast({
                      title: t`Error`,
                      description: t`No document selected. Please reload the page and try again.`,
                      variant: 'destructive',
                    });
                    return;
                  }

                  if (!currentEnvelopeItem.documentDataId) {
                    toast({
                      title: t`Error`,
                      description: t`Document data not found. Please try reloading the page.`,
                      variant: 'destructive',
                    });
                    return;
                  }

                  const { fieldsPerPage, errors } = await detectFormFieldsInDocument({
                    envelopeId: envelope.id,
                    onProgress: (current, total) => {
                      setProcessingProgress({ current, total });
                    },
                  });

                  let totalAdded = 0;
                  for (const [pageNumber, detectedFields] of fieldsPerPage.entries()) {
                    const pageCanvasRefs = getPageCanvasRefs(pageNumber);

                    for (const detected of detectedFields) {
                      const [ymin, xmin, ymax, xmax] = detected.boundingBox;
                      let positionX = (xmin / 1000) * 100;
                      let positionY = (ymin / 1000) * 100;
                      let width = ((xmax - xmin) / 1000) * 100;
                      let height = ((ymax - ymin) / 1000) * 100;

                      if (pageCanvasRefs) {
                        const adjusted = enforceMinimumFieldDimensions({
                          positionX,
                          positionY,
                          width,
                          height,
                          pageWidth: pageCanvasRefs.pdfCanvas.width,
                          pageHeight: pageCanvasRefs.pdfCanvas.height,
                        });

                        positionX = adjusted.positionX;
                        positionY = adjusted.positionY;
                        width = adjusted.width;
                        height = adjusted.height;
                      }

                      const fieldType = detected.label as FieldType;
                      const resolvedRecipientId =
                        envelope.recipients.find(
                          (recipient) => recipient.id === detected.recipientId,
                        )?.id ??
                        editorFields.selectedRecipient?.id ??
                        envelope.recipients[0]?.id;

                      if (!resolvedRecipientId) {
                        console.warn(
                          'Skipping detected field because no recipient could be resolved',
                          {
                            detectedRecipientId: detected.recipientId,
                          },
                        );
                        continue;
                      }

                      try {
                        editorFields.addField({
                          envelopeItemId: currentEnvelopeItem.id,
                          page: pageNumber,
                          type: fieldType,
                          positionX,
                          positionY,
                          width,
                          height,
                          recipientId: resolvedRecipientId,
                          fieldMeta: structuredClone(FIELD_META_DEFAULT_VALUES[fieldType]),
                        });
                        totalAdded++;
                      } catch (error) {
                        console.error(`Failed to add field on page ${pageNumber}:`, error);
                      }
                    }
                  }

                  const successfulPages = fieldsPerPage.size;
                  const failedPages = errors.size;

                  if (totalAdded > 0) {
                    let description = t`Added ${totalAdded} fields`;
                    if (fieldsPerPage.size > 1) {
                      description = t`Added ${totalAdded} fields across ${successfulPages} pages`;
                    }
                    if (failedPages > 0) {
                      description = t`Added ${totalAdded} fields across ${successfulPages} pages. ${failedPages} pages failed.`;
                    }

                    toast({
                      title: t`Success`,
                      description,
                    });
                  } else if (failedPages > 0) {
                    toast({
                      title: t`Error`,
                      description: t`Failed to detect fields on ${failedPages} pages. Please try again.`,
                      variant: 'destructive',
                    });
                  } else {
                    toast({
                      title: t`Info`,
                      description: t`No fields were detected in the document`,
                    });
                  }
                } catch (error) {
                  toast({
                    title: t`Error`,
                    description: t`An unexpected error occurred while processing pages.`,
                    variant: 'destructive',
                  });
                } finally {
                  setIsAutoAddingFields(false);
                  setProcessingProgress(null);
                }
              }}
            >
              {isDetectingFields ? <Trans>Processing...</Trans> : <Trans>Auto add fields</Trans>}
            </Button>
          </section>

          {/* Field details section. */}
          <AnimateGenericFadeInOut key={editorFields.selectedField?.formId}>
            {selectedField && (
              <section>
                <Separator className="my-4" />

                <div className="[&_label]:text-foreground/70 px-4 [&_label]:text-xs">
                  <h3 className="text-sm font-semibold">
                    {t(FieldSettingsTypeTranslations[selectedField.type])}
                  </h3>

                  {match(selectedField.type)
                    .with(FieldType.SIGNATURE, () => (
                      <EditorFieldSignatureForm
                        value={selectedField?.fieldMeta as TSignatureFieldMeta | undefined}
                        onValueChange={(value) => updateSelectedFieldMeta(value)}
                      />
                    ))
                    .with(FieldType.CHECKBOX, () => (
                      <EditorFieldCheckboxForm
                        value={selectedField?.fieldMeta as TCheckboxFieldMeta | undefined}
                        onValueChange={(value) => updateSelectedFieldMeta(value)}
                      />
                    ))
                    .with(FieldType.DATE, () => (
                      <EditorFieldDateForm
                        value={selectedField?.fieldMeta as TDateFieldMeta | undefined}
                        onValueChange={(value) => updateSelectedFieldMeta(value)}
                      />
                    ))
                    .with(FieldType.DROPDOWN, () => (
                      <EditorFieldDropdownForm
                        value={selectedField?.fieldMeta as TDropdownFieldMeta | undefined}
                        onValueChange={(value) => updateSelectedFieldMeta(value)}
                      />
                    ))
                    .with(FieldType.EMAIL, () => (
                      <EditorFieldEmailForm
                        value={selectedField?.fieldMeta as TEmailFieldMeta | undefined}
                        onValueChange={(value) => updateSelectedFieldMeta(value)}
                      />
                    ))
                    .with(FieldType.INITIALS, () => (
                      <EditorFieldInitialsForm
                        value={selectedField?.fieldMeta as TInitialsFieldMeta | undefined}
                        onValueChange={(value) => updateSelectedFieldMeta(value)}
                      />
                    ))
                    .with(FieldType.NAME, () => (
                      <EditorFieldNameForm
                        value={selectedField?.fieldMeta as TNameFieldMeta | undefined}
                        onValueChange={(value) => updateSelectedFieldMeta(value)}
                      />
                    ))
                    .with(FieldType.NUMBER, () => (
                      <EditorFieldNumberForm
                        value={selectedField?.fieldMeta as TNumberFieldMeta | undefined}
                        onValueChange={(value) => updateSelectedFieldMeta(value)}
                      />
                    ))
                    .with(FieldType.RADIO, () => (
                      <EditorFieldRadioForm
                        value={selectedField?.fieldMeta as TRadioFieldMeta | undefined}
                        onValueChange={(value) => updateSelectedFieldMeta(value)}
                      />
                    ))
                    .with(FieldType.TEXT, () => (
                      <EditorFieldTextForm
                        value={selectedField?.fieldMeta as TTextFieldMeta | undefined}
                        onValueChange={(value) => updateSelectedFieldMeta(value)}
                      />
                    ))
                    .otherwise(() => null)}
                </div>
              </section>
            )}
          </AnimateGenericFadeInOut>
        </div>
      )}
    </div>
  );
};
