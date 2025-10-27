import { lazy, useEffect, useMemo } from 'react';

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
  TTextFieldMeta,
} from '@documenso/lib/types/field-meta';
import { canRecipientFieldsBeModified } from '@documenso/lib/utils/recipients';
import { AnimateGenericFadeInOut } from '@documenso/ui/components/animate/animate-generic-fade-in-out';
import PDFViewerKonvaLazy from '@documenso/ui/components/pdf-viewer/pdf-viewer-konva-lazy';
import { Alert, AlertDescription } from '@documenso/ui/primitives/alert';
import { RecipientSelector } from '@documenso/ui/primitives/recipient-selector';
import { Separator } from '@documenso/ui/primitives/separator';

import { EditorFieldCheckboxForm } from '~/components/forms/editor/editor-field-checkbox-form';
import { EditorFieldDateForm } from '~/components/forms/editor/editor-field-date-form';
import { EditorFieldDropdownForm } from '~/components/forms/editor/editor-field-dropdown-form';
import { EditorFieldEmailForm } from '~/components/forms/editor/editor-field-email-form';
import { EditorFieldInitialsForm } from '~/components/forms/editor/editor-field-initials-form';
import { EditorFieldNameForm } from '~/components/forms/editor/editor-field-name-form';
import { EditorFieldNumberForm } from '~/components/forms/editor/editor-field-number-form';
import { EditorFieldRadioForm } from '~/components/forms/editor/editor-field-radio-form';
import { EditorFieldTextForm } from '~/components/forms/editor/editor-field-text-form';

import { EnvelopeEditorFieldDragDrop } from './envelope-editor-fields-drag-drop';
import { EnvelopeRendererFileSelector } from './envelope-file-selector';

const EnvelopeEditorFieldsPageRenderer = lazy(
  async () => import('./envelope-editor-fields-page-renderer'),
);

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
          </section>

          {/* Field details section. */}
          <AnimateGenericFadeInOut key={editorFields.selectedField?.formId}>
            {selectedField && selectedField.type !== FieldType.SIGNATURE && (
              <section>
                <Separator className="my-4" />

                <div className="[&_label]:text-foreground/70 px-4 [&_label]:text-xs">
                  <h3 className="text-sm font-semibold">
                    {t(FieldSettingsTypeTranslations[selectedField.type])}
                  </h3>

                  {match(selectedField.type)
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
