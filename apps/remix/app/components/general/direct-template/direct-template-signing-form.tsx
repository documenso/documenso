import { useEffect, useMemo, useState } from 'react';

import { Trans } from '@lingui/react/macro';
import type { Field, Recipient, Signature } from '@prisma/client';
import { FieldType } from '@prisma/client';
import { DateTime } from 'luxon';
import { match } from 'ts-pattern';

import { DEFAULT_DOCUMENT_DATE_FORMAT } from '@documenso/lib/constants/date-formats';
import { PDF_VIEWER_PAGE_SELECTOR } from '@documenso/lib/constants/pdf-viewer';
import { DEFAULT_DOCUMENT_TIME_ZONE } from '@documenso/lib/constants/time-zones';
import {
  ZCheckboxFieldMeta,
  ZDropdownFieldMeta,
  ZNumberFieldMeta,
  ZRadioFieldMeta,
  ZTextFieldMeta,
} from '@documenso/lib/types/field-meta';
import type { TTemplate } from '@documenso/lib/types/template';
import { isFieldUnsignedAndRequired } from '@documenso/lib/utils/advanced-fields-helpers';
import { sortFieldsByPosition, validateFieldsInserted } from '@documenso/lib/utils/fields';
import type {
  TRemovedSignedFieldWithTokenMutationSchema,
  TSignFieldWithTokenMutationSchema,
} from '@documenso/trpc/server/field-router/schema';
import { FieldToolTip } from '@documenso/ui/components/field/field-tooltip';
import { Button } from '@documenso/ui/primitives/button';
import {
  DocumentFlowFormContainerContent,
  DocumentFlowFormContainerFooter,
  DocumentFlowFormContainerHeader,
  DocumentFlowFormContainerStep,
} from '@documenso/ui/primitives/document-flow/document-flow-root';
import type { DocumentFlowStep } from '@documenso/ui/primitives/document-flow/types';
import { ElementVisible } from '@documenso/ui/primitives/element-visible';
import { Input } from '@documenso/ui/primitives/input';
import { Label } from '@documenso/ui/primitives/label';
import { SignaturePadDialog } from '@documenso/ui/primitives/signature-pad/signature-pad-dialog';
import { useStep } from '@documenso/ui/primitives/stepper';

import { DocumentSigningCheckboxField } from '~/components/general/document-signing/document-signing-checkbox-field';
import { DocumentSigningCompleteDialog } from '~/components/general/document-signing/document-signing-complete-dialog';
import { DocumentSigningDateField } from '~/components/general/document-signing/document-signing-date-field';
import { DocumentSigningDropdownField } from '~/components/general/document-signing/document-signing-dropdown-field';
import { DocumentSigningEmailField } from '~/components/general/document-signing/document-signing-email-field';
import { DocumentSigningInitialsField } from '~/components/general/document-signing/document-signing-initials-field';
import { DocumentSigningNameField } from '~/components/general/document-signing/document-signing-name-field';
import { DocumentSigningNumberField } from '~/components/general/document-signing/document-signing-number-field';
import { useRequiredDocumentSigningContext } from '~/components/general/document-signing/document-signing-provider';
import { DocumentSigningRadioField } from '~/components/general/document-signing/document-signing-radio-field';
import { DocumentSigningSignatureField } from '~/components/general/document-signing/document-signing-signature-field';
import { DocumentSigningTextField } from '~/components/general/document-signing/document-signing-text-field';

import { DocumentSigningRecipientProvider } from '../document-signing/document-signing-recipient-provider';

export type DirectTemplateSigningFormProps = {
  flowStep: DocumentFlowStep;
  directRecipient: Pick<Recipient, 'authOptions' | 'email' | 'role' | 'name' | 'token' | 'id'>;
  directRecipientFields: Field[];
  template: Omit<TTemplate, 'user'>;
  onSubmit: (
    _data: DirectTemplateLocalField[],
    _nextSigner?: { name: string; email: string },
  ) => Promise<void>;
};

export type DirectTemplateLocalField = Field & {
  signedValue?: TSignFieldWithTokenMutationSchema;
  signature?: Signature;
};

export const DirectTemplateSigningForm = ({
  flowStep,
  directRecipient,
  directRecipientFields,
  template,
  onSubmit,
}: DirectTemplateSigningFormProps) => {
  const { fullName, signature, setFullName, setSignature } = useRequiredDocumentSigningContext();

  const [localFields, setLocalFields] = useState<DirectTemplateLocalField[]>(directRecipientFields);
  const [validateUninsertedFields, setValidateUninsertedFields] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const highestPageNumber = Math.max(...localFields.map((field) => field.page));

  const fieldsRequiringValidation = useMemo(() => {
    return localFields.filter((field) => isFieldUnsignedAndRequired(field));
  }, [localFields]);

  const { currentStep, totalSteps, previousStep } = useStep();

  const onSignField = (value: TSignFieldWithTokenMutationSchema) => {
    setLocalFields(
      localFields.map((field) => {
        if (field.id !== value.fieldId) {
          return field;
        }

        const tempField: DirectTemplateLocalField = {
          ...field,
          customText: value.value ?? '',
          inserted: true,
          signedValue: value,
        };

        if (field.type === FieldType.SIGNATURE) {
          tempField.signature = {
            id: 1,
            created: new Date(),
            recipientId: 1,
            fieldId: 1,
            signatureImageAsBase64: value.value?.startsWith('data:') ? value.value : null,
            typedSignature: value.value && !value.value.startsWith('data:') ? value.value : null,
          } satisfies Signature;
        }

        if (field.type === FieldType.DATE) {
          tempField.customText = DateTime.now()
            .setZone(template.templateMeta?.timezone ?? DEFAULT_DOCUMENT_TIME_ZONE)
            .toFormat(template.templateMeta?.dateFormat ?? DEFAULT_DOCUMENT_DATE_FORMAT);
        }
        return tempField;
      }),
    );
  };

  const onUnsignField = (value: TRemovedSignedFieldWithTokenMutationSchema) => {
    setLocalFields(
      localFields.map((field) => {
        if (field.id !== value.fieldId) {
          return field;
        }

        return {
          ...field,
          customText: '',
          inserted: false,
          signedValue: undefined,
          signature: undefined,
        };
      }),
    );
  };

  const uninsertedFields = useMemo(() => {
    return sortFieldsByPosition(fieldsRequiringValidation);
  }, [localFields]);

  const fieldsValidated = () => {
    setValidateUninsertedFields(true);
    validateFieldsInserted(fieldsRequiringValidation);
  };

  const handleSubmit = async (nextSigner?: { name: string; email: string }) => {
    setValidateUninsertedFields(true);

    const isFieldsValid = validateFieldsInserted(fieldsRequiringValidation);

    if (!isFieldsValid) {
      return;
    }

    setIsSubmitting(true);

    try {
      await onSubmit(localFields, nextSigner);
    } catch {
      setIsSubmitting(false);
    }

    // Do not reset to false since we do a redirect.
  };

  useEffect(() => {
    const updatedFields = [...localFields];

    localFields.forEach((field) => {
      const index = updatedFields.findIndex((f) => f.id === field.id);
      let value = '';

      match(field.type)
        .with(FieldType.TEXT, () => {
          const meta = field.fieldMeta ? ZTextFieldMeta.safeParse(field.fieldMeta) : null;

          if (meta?.success) {
            value = meta.data.text ?? '';
          }
        })
        .with(FieldType.NUMBER, () => {
          const meta = field.fieldMeta ? ZNumberFieldMeta.safeParse(field.fieldMeta) : null;

          if (meta?.success) {
            value = meta.data.value ?? '';
          }
        })
        .with(FieldType.DROPDOWN, () => {
          const meta = field.fieldMeta ? ZDropdownFieldMeta.safeParse(field.fieldMeta) : null;

          if (meta?.success) {
            value = meta.data.defaultValue ?? '';
          }
        });

      if (value) {
        const signedValue = {
          token: directRecipient.token,
          fieldId: field.id,
          value,
        };

        updatedFields[index] = {
          ...field,
          customText: value,
          inserted: true,
          signedValue,
        };
      }
    });

    setLocalFields(updatedFields);
  }, []);

  const nextRecipient = useMemo(() => {
    if (
      !template.templateMeta?.signingOrder ||
      template.templateMeta.signingOrder !== 'SEQUENTIAL' ||
      !template.templateMeta.allowDictateNextSigner
    ) {
      return undefined;
    }

    const sortedRecipients = template.recipients.sort((a, b) => {
      // Sort by signingOrder first (nulls last), then by id
      if (a.signingOrder === null && b.signingOrder === null) return a.id - b.id;
      if (a.signingOrder === null) return 1;
      if (b.signingOrder === null) return -1;
      if (a.signingOrder === b.signingOrder) return a.id - b.id;
      return a.signingOrder - b.signingOrder;
    });

    const currentIndex = sortedRecipients.findIndex((r) => r.id === directRecipient.id);
    return currentIndex !== -1 && currentIndex < sortedRecipients.length - 1
      ? sortedRecipients[currentIndex + 1]
      : undefined;
  }, [template.templateMeta?.signingOrder, template.recipients, directRecipient.id]);

  return (
    <DocumentSigningRecipientProvider recipient={directRecipient}>
      <DocumentFlowFormContainerHeader title={flowStep.title} description={flowStep.description} />

      <DocumentFlowFormContainerContent>
        <ElementVisible
          target={`${PDF_VIEWER_PAGE_SELECTOR}[data-page-number="${highestPageNumber}"]`}
        >
          {validateUninsertedFields && uninsertedFields[0] && (
            <FieldToolTip key={uninsertedFields[0].id} field={uninsertedFields[0]} color="warning">
              <Trans>Click to insert field</Trans>
            </FieldToolTip>
          )}

          {localFields.map((field) =>
            match(field.type)
              .with(FieldType.SIGNATURE, () => (
                <DocumentSigningSignatureField
                  key={field.id}
                  field={field}
                  onSignField={onSignField}
                  onUnsignField={onUnsignField}
                  typedSignatureEnabled={template.templateMeta?.typedSignatureEnabled}
                  uploadSignatureEnabled={template.templateMeta?.uploadSignatureEnabled}
                  drawSignatureEnabled={template.templateMeta?.drawSignatureEnabled}
                />
              ))
              .with(FieldType.INITIALS, () => (
                <DocumentSigningInitialsField
                  key={field.id}
                  field={field}
                  onSignField={onSignField}
                  onUnsignField={onUnsignField}
                />
              ))
              .with(FieldType.NAME, () => (
                <DocumentSigningNameField
                  key={field.id}
                  field={field}
                  onSignField={onSignField}
                  onUnsignField={onUnsignField}
                />
              ))
              .with(FieldType.DATE, () => (
                <DocumentSigningDateField
                  key={field.id}
                  field={field}
                  dateFormat={template.templateMeta?.dateFormat ?? DEFAULT_DOCUMENT_DATE_FORMAT}
                  timezone={template.templateMeta?.timezone ?? DEFAULT_DOCUMENT_TIME_ZONE}
                  onSignField={onSignField}
                  onUnsignField={onUnsignField}
                />
              ))
              .with(FieldType.EMAIL, () => (
                <DocumentSigningEmailField
                  key={field.id}
                  field={field}
                  onSignField={onSignField}
                  onUnsignField={onUnsignField}
                />
              ))
              .with(FieldType.TEXT, () => {
                const parsedFieldMeta = field.fieldMeta
                  ? ZTextFieldMeta.parse(field.fieldMeta)
                  : null;

                return (
                  <DocumentSigningTextField
                    key={field.id}
                    field={{
                      ...field,
                      fieldMeta: parsedFieldMeta,
                    }}
                    onSignField={onSignField}
                    onUnsignField={onUnsignField}
                  />
                );
              })
              .with(FieldType.NUMBER, () => {
                const parsedFieldMeta = field.fieldMeta
                  ? ZNumberFieldMeta.parse(field.fieldMeta)
                  : null;

                return (
                  <DocumentSigningNumberField
                    key={field.id}
                    field={{
                      ...field,
                      fieldMeta: parsedFieldMeta,
                    }}
                    onSignField={onSignField}
                    onUnsignField={onUnsignField}
                  />
                );
              })
              .with(FieldType.DROPDOWN, () => {
                const parsedFieldMeta = field.fieldMeta
                  ? ZDropdownFieldMeta.parse(field.fieldMeta)
                  : null;

                return (
                  <DocumentSigningDropdownField
                    key={field.id}
                    field={{
                      ...field,
                      fieldMeta: parsedFieldMeta,
                    }}
                    onSignField={onSignField}
                    onUnsignField={onUnsignField}
                  />
                );
              })
              .with(FieldType.RADIO, () => {
                const parsedFieldMeta = field.fieldMeta
                  ? ZRadioFieldMeta.parse(field.fieldMeta)
                  : null;

                return (
                  <DocumentSigningRadioField
                    key={field.id}
                    field={{
                      ...field,
                      fieldMeta: parsedFieldMeta,
                    }}
                    onSignField={onSignField}
                    onUnsignField={onUnsignField}
                  />
                );
              })
              .with(FieldType.CHECKBOX, () => {
                const parsedFieldMeta = field.fieldMeta
                  ? ZCheckboxFieldMeta.parse(field.fieldMeta)
                  : null;

                return (
                  <DocumentSigningCheckboxField
                    key={field.id}
                    field={{
                      ...field,
                      fieldMeta: parsedFieldMeta,
                    }}
                    onSignField={onSignField}
                    onUnsignField={onUnsignField}
                  />
                );
              })
              .otherwise(() => null),
          )}
        </ElementVisible>

        <div className="-mx-2 flex flex-1 flex-col gap-4 overflow-y-auto px-2">
          <div className="flex flex-1 flex-col gap-y-4">
            <div>
              <Label htmlFor="full-name">
                <Trans>Full Name</Trans>
              </Label>

              <Input
                id="full-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value.trimStart())}
              />
            </div>

            <div>
              <Label htmlFor="Signature">
                <Trans>Signature</Trans>
              </Label>

              <SignaturePadDialog
                className="mt-2"
                disabled={isSubmitting}
                value={signature ?? ''}
                onChange={(value) => setSignature(value)}
                typedSignatureEnabled={template.templateMeta?.typedSignatureEnabled}
                uploadSignatureEnabled={template.templateMeta?.uploadSignatureEnabled}
                drawSignatureEnabled={template.templateMeta?.drawSignatureEnabled}
              />
            </div>
          </div>
        </div>
      </DocumentFlowFormContainerContent>

      <DocumentFlowFormContainerFooter>
        <DocumentFlowFormContainerStep step={currentStep} maxStep={totalSteps} />

        <div className="mt-4 flex gap-x-4">
          <Button
            className="dark:bg-muted dark:hover:bg-muted/80 w-full bg-black/5 hover:bg-black/10"
            size="lg"
            variant="secondary"
            disabled={isSubmitting}
            onClick={previousStep}
          >
            <Trans>Back</Trans>
          </Button>

          <DocumentSigningCompleteDialog
            isSubmitting={isSubmitting}
            onSignatureComplete={async (nextSigner) => handleSubmit(nextSigner)}
            documentTitle={template.title}
            fields={localFields}
            fieldsValidated={fieldsValidated}
            recipient={directRecipient}
            allowDictateNextSigner={nextRecipient && template.templateMeta?.allowDictateNextSigner}
            defaultNextSigner={
              nextRecipient ? { name: nextRecipient.name, email: nextRecipient.email } : undefined
            }
          />
        </div>
      </DocumentFlowFormContainerFooter>
    </DocumentSigningRecipientProvider>
  );
};
