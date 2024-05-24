'use client';

import { useMemo, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { DateTime } from 'luxon';
import { useForm } from 'react-hook-form';
import { match } from 'ts-pattern';

import { DEFAULT_DOCUMENT_DATE_FORMAT } from '@documenso/lib/constants/date-formats';
import { PDF_VIEWER_PAGE_SELECTOR } from '@documenso/lib/constants/pdf-viewer';
import { sortFieldsByPosition, validateFieldsInserted } from '@documenso/lib/utils/fields';
import type { Field } from '@documenso/prisma/client';
import { FieldType } from '@documenso/prisma/client';
import type { FieldWithSignature } from '@documenso/prisma/types/field-with-signature';
import type { DocumentFlowStep } from '@documenso/ui/primitives/document-flow/types';

import { FieldToolTip } from '../../components/field/field-tooltip';
import { cn } from '../../lib/utils';
import { Card, CardContent } from '../card';
import { ElementVisible } from '../element-visible';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../form/form';
import { Input } from '../input';
import { SignaturePad } from '../signature-pad';
import { useStep } from '../stepper';
import type { TAddSignatureFormSchema } from './add-signature.types';
import { ZAddSignatureFormSchema } from './add-signature.types';
import {
  DocumentFlowFormContainerActions,
  DocumentFlowFormContainerContent,
  DocumentFlowFormContainerFooter,
  DocumentFlowFormContainerHeader,
  DocumentFlowFormContainerStep,
} from './document-flow-root';
import {
  SinglePlayerModeCustomTextField,
  SinglePlayerModeSignatureField,
} from './single-player-mode-fields';

export type AddSignatureFormProps = {
  defaultValues?: TAddSignatureFormSchema;
  documentFlow: DocumentFlowStep;
  fields: FieldWithSignature[];

  onSubmit: (_data: TAddSignatureFormSchema) => Promise<void> | void;
  requireName?: boolean;
  requireCustomText?: boolean;
  requireSignature?: boolean;
};

export const AddSignatureFormPartial = ({
  defaultValues,
  documentFlow,
  fields,

  onSubmit,
  requireName = false,
  requireCustomText = false,
  requireSignature = true,
}: AddSignatureFormProps) => {
  const { currentStep, totalSteps } = useStep();

  const [validateUninsertedFields, setValidateUninsertedFields] = useState(false);

  // Refined schema which takes into account whether to allow an empty name or signature.
  const refinedSchema = ZAddSignatureFormSchema.superRefine((val, ctx) => {
    if (requireName && val.name.length === 0) {
      ctx.addIssue({
        path: ['name'],
        code: 'custom',
        message: 'Name is required',
      });
    }

    if (requireCustomText && val.customText.length === 0) {
      ctx.addIssue({
        path: ['customText'],
        code: 'custom',
        message: 'Text is required',
      });
    }

    if (requireSignature && val.signature.length === 0) {
      ctx.addIssue({
        path: ['signature'],
        code: 'custom',
        message: 'Signature is required',
      });
    }
  });

  const form = useForm<TAddSignatureFormSchema>({
    resolver: zodResolver(refinedSchema),
    defaultValues: defaultValues ?? {
      name: '',
      email: '',
      signature: '',
      customText: '',
    },
  });

  /**
   * A local copy of the provided fields to modify.
   */
  const [localFields, setLocalFields] = useState<Field[]>(JSON.parse(JSON.stringify(fields)));

  const uninsertedFields = useMemo(() => {
    const fields = localFields.filter((field) => !field.inserted);

    return sortFieldsByPosition(fields);
  }, [localFields]);

  const onValidateFields = async (values: TAddSignatureFormSchema) => {
    setValidateUninsertedFields(true);
    const isFieldsValid = validateFieldsInserted(localFields);

    if (!isFieldsValid) {
      return;
    }

    await onSubmit(values);
  };

  /**
   * Validates whether the corresponding form for a given field type is valid.
   *
   * @returns `true` if the form associated with the provided field is valid, `false` otherwise.
   */
  const validateFieldForm = async (fieldType: Field['type']): Promise<boolean> => {
    if (fieldType === FieldType.SIGNATURE) {
      await form.trigger('signature');
      return !form.formState.errors.signature;
    }

    if (fieldType === FieldType.NAME) {
      await form.trigger('name');
      return !form.formState.errors.name;
    }

    if (fieldType === FieldType.EMAIL) {
      await form.trigger('email');
      return !form.formState.errors.email;
    }

    if (fieldType === FieldType.TEXT) {
      await form.trigger('customText');
      return !form.formState.errors.customText;
    }

    return true;
  };

  /**
   * Insert the corresponding form value into a given field.
   */
  const insertFormValueIntoField = (field: Field) => {
    return match(field.type)
      .with(FieldType.DATE, () => ({
        ...field,
        customText: DateTime.now().toFormat(DEFAULT_DOCUMENT_DATE_FORMAT),
        inserted: true,
      }))
      .with(FieldType.EMAIL, () => ({
        ...field,
        customText: form.getValues('email'),
        inserted: true,
      }))
      .with(FieldType.NAME, () => ({
        ...field,
        customText: form.getValues('name'),
        inserted: true,
      }))
      .with(FieldType.TEXT, () => ({
        ...field,
        customText: form.getValues('customText'),
        inserted: true,
      }))
      .with(FieldType.SIGNATURE, () => {
        const value = form.getValues('signature');

        return {
          ...field,
          value,
          Signature: {
            id: -1,
            recipientId: -1,
            fieldId: -1,
            created: new Date(),
            signatureImageAsBase64: value,
            typedSignature: null,
          },
          inserted: true,
        };
      })
      .otherwise(() => {
        throw new Error('Unsupported field');
      });
  };

  const insertField = (field: Field) => async () => {
    const isFieldFormValid = await validateFieldForm(field.type);
    if (!isFieldFormValid) {
      return;
    }

    setLocalFields((prev) =>
      prev.map((prevField) => {
        if (prevField.id !== field.id) {
          return prevField;
        }

        return insertFormValueIntoField(field);
      }),
    );
  };

  /**
   * When a form value changes, reset all the corresponding fields to be uninserted.
   */
  const onFormValueChange = (fieldType: FieldType) => {
    setLocalFields((fields) =>
      fields.map((field) => {
        if (field.type !== fieldType) {
          return field;
        }

        return {
          ...field,
          inserted: false,
        };
      }),
    );
  };

  return (
    <>
      <DocumentFlowFormContainerHeader
        title={documentFlow.title}
        description={documentFlow.description}
      />

      <Form {...form}>
        <fieldset className="flex h-full flex-col" disabled={form.formState.isSubmitting}>
          <DocumentFlowFormContainerContent>
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>Email</FormLabel>
                    <FormControl>
                      <Input
                        className="bg-background"
                        type="email"
                        autoComplete="email"
                        {...field}
                        onChange={(value) => {
                          onFormValueChange(FieldType.EMAIL);
                          field.onChange(value);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {requireName && (
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel required={requireName}>Name</FormLabel>
                      <FormControl>
                        <Input
                          className="bg-background"
                          {...field}
                          onChange={(value) => {
                            onFormValueChange(FieldType.NAME);
                            field.onChange(value);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {requireSignature && (
                <FormField
                  control={form.control}
                  name="signature"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel required={requireSignature}>Signature</FormLabel>
                      <FormControl>
                        <Card
                          className={cn('mt-2', {
                            'rounded-sm ring-2 ring-red-500 ring-offset-2 transition-all':
                              form.formState.errors.signature,
                          })}
                          gradient={!form.formState.errors.signature}
                          degrees={-120}
                        >
                          <CardContent className="p-0">
                            <SignaturePad
                              className="h-44 w-full"
                              defaultValue={field.value}
                              onBlur={field.onBlur}
                              onChange={(value) => {
                                onFormValueChange(FieldType.SIGNATURE);
                                field.onChange(value);
                              }}
                            />
                          </CardContent>
                        </Card>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {requireCustomText && (
                <FormField
                  control={form.control}
                  name="customText"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel required={requireCustomText}>Custom Text</FormLabel>
                      <FormControl>
                        <Input
                          className="bg-background"
                          {...field}
                          onChange={(value) => {
                            onFormValueChange(FieldType.TEXT);
                            field.onChange(value);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>
          </DocumentFlowFormContainerContent>

          <DocumentFlowFormContainerFooter>
            <DocumentFlowFormContainerStep
              title={documentFlow.title}
              step={currentStep}
              maxStep={totalSteps}
            />

            <DocumentFlowFormContainerActions
              loading={form.formState.isSubmitting}
              disabled={form.formState.isSubmitting}
              onGoBackClick={documentFlow.onBackStep}
              onGoNextClick={form.handleSubmit(onValidateFields)}
            />
          </DocumentFlowFormContainerFooter>
        </fieldset>

        {validateUninsertedFields && uninsertedFields[0] && (
          <FieldToolTip key={uninsertedFields[0].id} field={uninsertedFields[0]} color="warning">
            Click to insert field
          </FieldToolTip>
        )}

        <ElementVisible target={PDF_VIEWER_PAGE_SELECTOR}>
          {localFields.map((field) =>
            match(field.type)
              .with(FieldType.DATE, FieldType.TEXT, FieldType.EMAIL, FieldType.NAME, () => {
                return (
                  <SinglePlayerModeCustomTextField
                    onClick={insertField(field)}
                    key={field.id}
                    field={field}
                  />
                );
              })
              .with(FieldType.SIGNATURE, () => (
                <SinglePlayerModeSignatureField
                  onClick={insertField(field)}
                  key={field.id}
                  field={field}
                />
              ))
              .otherwise(() => {
                return null;
              }),
          )}
        </ElementVisible>
      </Form>
    </>
  );
};
