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
import {
  compositePageToBlob,
  getPageCanvasRefs,
} from '@documenso/lib/client-only/utils/page-canvas-registry';
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
import { Alert, AlertDescription } from '@documenso/ui/primitives/alert';
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

/**
 * Enforces minimum field dimensions and centers the field when expanding to meet minimums.
 *
 * AI often detects form lines as very thin fields (0.2-0.5% height). This function ensures
 * fields meet minimum usability requirements by expanding them to at least 30px height and
 * 36px width, while keeping them centered on their original position.
 *
 * @param params - Field dimensions and page size
 * @param params.positionX - Field X position as percentage (0-100)
 * @param params.positionY - Field Y position as percentage (0-100)
 * @param params.width - Field width as percentage (0-100)
 * @param params.height - Field height as percentage (0-100)
 * @param params.pageWidth - Page width in pixels
 * @param params.pageHeight - Page height in pixels
 * @returns Adjusted field dimensions with minimums enforced and centered
 *
 * @example
 * // AI detected a thin line: 0.3% height
 * const adjusted = enforceMinimumFieldDimensions({
 *   positionX: 20, positionY: 50, width: 30, height: 0.3,
 *   pageWidth: 800, pageHeight: 1100
 * });
 * // Result: height expanded to ~2.7% (30px), centered on original position
 */
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

  // Convert percentage to pixels to check against minimums
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

  const [isAutoAddingFields, setIsAutoAddingFields] = useState(false);

  const selectedField = useMemo(
    () => structuredClone(editorFields.selectedField),
    [editorFields.selectedField],
  );

  const updateSelectedFieldMeta = (fieldMeta: TFieldMetaSchema) => {
    if (!selectedField) {
      return;
    }

    const isMetaSame = isDeepEqual(selectedField.fieldMeta, fieldMeta);

    // Todo: Envelopes - Clean up console logs.
    if (!isMetaSame) {
      console.log('TRIGGER UPDATE');
      editorFields.updateFieldByFormId(selectedField.formId, {
        fieldMeta,
      });
    } else {
      console.log('DATA IS SAME, NO UPDATE');
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
      <div className="flex w-full flex-col overflow-y-auto">
        {/* Horizontal envelope item selector */}
        <EnvelopeRendererFileSelector fields={editorFields.localFields} />

        {/* Document View */}
        <div className="mt-4 flex h-full justify-center p-4">
          {currentEnvelopeItem !== null ? (
            <PDFViewerKonvaLazy customPageRenderer={EnvelopeEditorFieldsPageRenderer} />
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
      {currentEnvelopeItem && (
        <div className="bg-background border-border sticky top-0 h-full w-80 flex-shrink-0 overflow-y-auto border-l py-4">
          {/* Recipient selector section. */}
          <section className="px-4">
            <h3 className="text-foreground mb-2 text-sm font-semibold">
              <Trans>Selected Recipient</Trans>
            </h3>

            {envelope.recipients.length === 0 ? (
              <Alert variant="warning">
                <AlertDescription className="flex flex-col gap-2">
                  <Trans>You need at least one recipient to add fields</Trans>

                  <Link to={`${relativePath.editorPath}`} className="text-sm">
                    <p>
                      <Trans>Click here to add a recipient</Trans>
                    </p>
                  </Link>
                </AlertDescription>
              </Alert>
            ) : (
              <RecipientSelector
                selectedRecipient={editorFields.selectedRecipient}
                onSelectedRecipientChange={(recipient) =>
                  editorFields.setSelectedRecipient(recipient.id)
                }
                recipients={envelope.recipients}
                className="w-full"
                align="end"
              />
            )}

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
              disabled={isAutoAddingFields}
              onClick={async () => {
                setIsAutoAddingFields(true);

                try {
                  const blob = await compositePageToBlob(1);

                  if (!blob) {
                    toast({
                      title: t`Error`,
                      description: t`Failed to capture page. Please ensure the document is fully loaded.`,
                      variant: 'destructive',
                    });
                    return;
                  }

                  console.log('Successfully captured page 1 as PNG Blob:', {
                    size: `${(blob.size / 1024).toFixed(2)} KB`,
                    type: blob.type,
                  });
                  console.log('Blob object:', blob);

                  console.log('[Auto Add Fields] Sending image to AI endpoint...');
                  const formData = new FormData();
                  formData.append('image', blob, 'page-1.png');

                  const response = await fetch('/api/ai/detect-object-and-draw', {
                    method: 'POST',
                    body: formData,
                    credentials: 'include',
                  });

                  if (!response.ok) {
                    throw new Error(`AI detection failed: ${response.statusText}`);
                  }

                  const detectedFields = await response.json();
                  console.log(
                    `[Auto Add Fields] Detected ${detectedFields.length} fields:`,
                    detectedFields,
                  );

                  if (!editorFields.selectedRecipient || !currentEnvelopeItem) {
                    toast({
                      title: t`Warning`,
                      description: t`Please select a recipient before adding fields.`,
                      variant: 'destructive',
                    });
                    return;
                  }

                  const pageCanvasRefs = getPageCanvasRefs(1);
                  if (!pageCanvasRefs) {
                    console.warn(
                      '[Auto Add Fields] Could not get page dimensions for minimum field enforcement',
                    );
                  }

                  let addedCount = 0;
                  for (const detected of detectedFields) {
                    const [ymin, xmin, ymax, xmax] = detected.box_2d;
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

                    try {
                      editorFields.addField({
                        envelopeItemId: currentEnvelopeItem.id,
                        page: 1,
                        type: fieldType,
                        positionX,
                        positionY,
                        width,
                        height,
                        recipientId: editorFields.selectedRecipient.id,
                        fieldMeta: structuredClone(FIELD_META_DEFAULT_VALUES[fieldType]),
                      });
                      addedCount++;
                    } catch (error) {
                      console.error(`Failed to add ${fieldType} field:`, error);
                    }
                  }

                  console.log(
                    `[Auto Add Fields] Successfully added ${addedCount} fields to the document`,
                  );

                  toast({
                    title: t`Success`,
                    description: t`Added ${addedCount} fields to the document`,
                  });
                } catch (error) {
                  console.error('Auto add fields error:', error);
                  toast({
                    title: t`Error`,
                    description: t`An unexpected error occurred while capturing the page.`,
                    variant: 'destructive',
                  });
                } finally {
                  setIsAutoAddingFields(false);
                }
              }}
            >
              {isAutoAddingFields ? <Trans>Processing...</Trans> : <Trans>Auto add fields</Trans>}
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
