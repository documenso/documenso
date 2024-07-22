import { useMemo, useState } from 'react';

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
import { sortFieldsByPosition, validateFieldsInserted } from '@documenso/lib/utils/fields';
import type { Field, Recipient, Signature } from '@documenso/prisma/client';
import { FieldType } from '@documenso/prisma/client';
import type { TemplateWithDetails } from '@documenso/prisma/types/template';
import type {
  TRemovedSignedFieldWithTokenMutationSchema,
  TSignFieldWithTokenMutationSchema,
} from '@documenso/trpc/server/field-router/schema';
import { FieldToolTip } from '@documenso/ui/components/field/field-tooltip';
import { Button } from '@documenso/ui/primitives/button';
import { Card, CardContent } from '@documenso/ui/primitives/card';
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
import { SignaturePad } from '@documenso/ui/primitives/signature-pad';
import { useStep } from '@documenso/ui/primitives/stepper';

import { CheckboxField } from '~/app/(signing)/sign/[token]/checkbox-field';
import { DateField } from '~/app/(signing)/sign/[token]/date-field';
import { DropdownField } from '~/app/(signing)/sign/[token]/dropdown-field';
import { EmailField } from '~/app/(signing)/sign/[token]/email-field';
import { NameField } from '~/app/(signing)/sign/[token]/name-field';
import { NumberField } from '~/app/(signing)/sign/[token]/number-field';
import { useRequiredSigningContext } from '~/app/(signing)/sign/[token]/provider';
import { RadioField } from '~/app/(signing)/sign/[token]/radio-field';
import { SignDialog } from '~/app/(signing)/sign/[token]/sign-dialog';
import { SignatureField } from '~/app/(signing)/sign/[token]/signature-field';
import { TextField } from '~/app/(signing)/sign/[token]/text-field';

export type SignDirectTemplateFormProps = {
  flowStep: DocumentFlowStep;
  directRecipient: Recipient;
  directRecipientFields: Field[];
  template: TemplateWithDetails;
  onSubmit: (_data: DirectTemplateLocalField[]) => Promise<void>;
};

export type DirectTemplateLocalField = Field & {
  signedValue?: TSignFieldWithTokenMutationSchema;
  Signature?: Signature;
};

export const SignDirectTemplateForm = ({
  flowStep,
  directRecipient,
  directRecipientFields,
  template,
  onSubmit,
}: SignDirectTemplateFormProps) => {
  const { fullName, signature, setFullName, setSignature } = useRequiredSigningContext();

  const [localFields, setLocalFields] = useState<DirectTemplateLocalField[]>(directRecipientFields);
  const [validateUninsertedFields, setValidateUninsertedFields] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { currentStep, totalSteps, previousStep } = useStep();

  const onSignField = (value: TSignFieldWithTokenMutationSchema) => {
    setLocalFields(
      localFields.map((field) => {
        if (field.id !== value.fieldId) {
          return field;
        }

        const tempField: DirectTemplateLocalField = {
          ...field,
          customText: value.value,
          inserted: true,
          signedValue: value,
        };

        if (field.type === FieldType.SIGNATURE) {
          tempField.Signature = {
            id: 1,
            created: new Date(),
            recipientId: 1,
            fieldId: 1,
            signatureImageAsBase64: value.value,
            typedSignature: null,
          };
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
          Signature: undefined,
        };
      }),
    );
  };

  const uninsertedFields = useMemo(() => {
    return sortFieldsByPosition(localFields.filter((field) => !field.inserted));
  }, [localFields]);

  const fieldsValidated = () => {
    setValidateUninsertedFields(true);
    validateFieldsInserted(localFields);
  };

  const handleSubmit = async () => {
    setValidateUninsertedFields(true);

    const isFieldsValid = validateFieldsInserted(localFields);

    if (!isFieldsValid) {
      return;
    }

    setIsSubmitting(true);

    try {
      await onSubmit(localFields);
    } catch {
      setIsSubmitting(false);
    }

    // Do not reset to false since we do a redirect.
  };

  return (
    <>
      <DocumentFlowFormContainerHeader title={flowStep.title} description={flowStep.description} />

      <DocumentFlowFormContainerContent>
        <ElementVisible target={PDF_VIEWER_PAGE_SELECTOR}>
          {validateUninsertedFields && uninsertedFields[0] && (
            <FieldToolTip key={uninsertedFields[0].id} field={uninsertedFields[0]} color="warning">
              Click to insert field
            </FieldToolTip>
          )}

          {localFields.map((field) =>
            match(field.type)
              .with(FieldType.SIGNATURE, () => (
                <SignatureField
                  key={field.id}
                  field={field}
                  recipient={directRecipient}
                  onSignField={onSignField}
                  onUnsignField={onUnsignField}
                />
              ))
              .with(FieldType.NAME, () => (
                <NameField
                  key={field.id}
                  field={field}
                  recipient={directRecipient}
                  onSignField={onSignField}
                  onUnsignField={onUnsignField}
                />
              ))
              .with(FieldType.DATE, () => (
                <DateField
                  key={field.id}
                  field={field}
                  recipient={directRecipient}
                  dateFormat={template.templateMeta?.dateFormat ?? DEFAULT_DOCUMENT_DATE_FORMAT}
                  timezone={template.templateMeta?.timezone ?? DEFAULT_DOCUMENT_TIME_ZONE}
                  onSignField={onSignField}
                  onUnsignField={onUnsignField}
                />
              ))
              .with(FieldType.EMAIL, () => (
                <EmailField
                  key={field.id}
                  field={field}
                  recipient={directRecipient}
                  onSignField={onSignField}
                  onUnsignField={onUnsignField}
                />
              ))
              .with(FieldType.TEXT, () => {
                const parsedFieldMeta = field.fieldMeta
                  ? ZTextFieldMeta.parse(field.fieldMeta)
                  : null;

                return (
                  <TextField
                    key={field.id}
                    field={{
                      ...field,
                      fieldMeta: parsedFieldMeta,
                    }}
                    recipient={directRecipient}
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
                  <NumberField
                    key={field.id}
                    field={{
                      ...field,
                      fieldMeta: parsedFieldMeta,
                    }}
                    recipient={directRecipient}
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
                  <DropdownField
                    key={field.id}
                    field={{
                      ...field,
                      fieldMeta: parsedFieldMeta,
                    }}
                    recipient={directRecipient}
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
                  <RadioField
                    key={field.id}
                    field={{
                      ...field,
                      fieldMeta: parsedFieldMeta,
                    }}
                    recipient={directRecipient}
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
                  <CheckboxField
                    key={field.id}
                    field={{
                      ...field,
                      fieldMeta: parsedFieldMeta,
                    }}
                    recipient={directRecipient}
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
              <Label htmlFor="full-name">Full Name</Label>

              <Input
                id="full-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value.trimStart())}
              />
            </div>

            <div>
              <Label htmlFor="Signature">Signature</Label>

              <Card className="mt-2" gradient degrees={-120}>
                <CardContent className="p-0">
                  <SignaturePad
                    className="h-44 w-full"
                    disabled={isSubmitting}
                    defaultValue={signature ?? undefined}
                    onChange={(value) => {
                      setSignature(value);
                    }}
                  />
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </DocumentFlowFormContainerContent>

      <DocumentFlowFormContainerFooter>
        <DocumentFlowFormContainerStep
          title={flowStep.title}
          step={currentStep}
          maxStep={totalSteps}
        />

        <div className="mt-4 flex gap-x-4">
          <Button
            className="dark:bg-muted dark:hover:bg-muted/80 w-full bg-black/5 hover:bg-black/10"
            size="lg"
            variant="secondary"
            disabled={isSubmitting}
            onClick={previousStep}
          >
            Back
          </Button>

          <SignDialog
            isSubmitting={isSubmitting}
            onSignatureComplete={handleSubmit}
            documentTitle={template.title}
            fields={localFields}
            fieldsValidated={fieldsValidated}
            role={directRecipient.role}
          />
        </div>
      </DocumentFlowFormContainerFooter>
    </>
  );
};
