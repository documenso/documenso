'use client';

import { useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { DateTime } from 'luxon';
import { useForm } from 'react-hook-form';
import { match } from 'ts-pattern';

import { PDF_VIEWER_PAGE_SELECTOR } from '@documenso/lib/constants/pdf-viewer';
import { FieldType } from '@documenso/prisma/client';
import { FieldWithSignature } from '@documenso/prisma/types/field-with-signature';
import { cn } from '@documenso/ui/lib/utils';
import { Card, CardContent } from '@documenso/ui/primitives/card';
import { TAddSignatureFormSchema } from '@documenso/ui/primitives/document-flow/add-signature.types';
import {
  DocumentFlowFormContainerActions,
  DocumentFlowFormContainerContent,
  DocumentFlowFormContainerFooter,
  DocumentFlowFormContainerStep,
} from '@documenso/ui/primitives/document-flow/document-flow-root';
import { DocumentFlowStep } from '@documenso/ui/primitives/document-flow/types';
import { ElementVisible } from '@documenso/ui/primitives/element-visible';
import { Input } from '@documenso/ui/primitives/input';
import { SignaturePad } from '@documenso/ui/primitives/signature-pad';

import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../form/form';
import { ZAddSignatureFormSchema } from './add-signature.types';
import {
  SinglePlayerModeCustomTextField,
  SinglePlayerModeSignatureField,
} from './single-player-mode-fields';

export type AddSignatureFormProps = {
  defaultValues?: TAddSignatureFormSchema;
  documentFlow: DocumentFlowStep;
  fields: FieldWithSignature[];
  numberOfSteps: number;
  onSubmit: (_data: TAddSignatureFormSchema) => Promise<void> | void;
  requireName?: boolean;
  requireSignature?: boolean;
};

export const AddSignatureFormPartial = ({
  defaultValues,
  documentFlow,
  fields,
  numberOfSteps,
  onSubmit,
  requireName = false,
  requireSignature = true,
}: AddSignatureFormProps) => {
  // Refined schema which takes into account whether to allow an empty name or signature.
  const refinedSchema = ZAddSignatureFormSchema.superRefine((val, ctx) => {
    if (requireName && val.name.length === 0) {
      ctx.addIssue({
        path: ['name'],
        code: 'custom',
        message: 'Name is required',
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
    },
  });

  /**
   * A local copy of the provided fields to modify.
   */
  const [localFields, setLocalFields] = useState(
    fields.map((field) => {
      let customText = field.customText;

      if (field.type === FieldType.DATE) {
        customText = DateTime.now().toFormat('yyyy-MM-dd hh:mm a');
      }

      const inserted = match(field.type)
        .with(FieldType.DATE, () => true)
        .with(FieldType.NAME, () => form.getValues('name').length > 0)
        .with(FieldType.EMAIL, () => form.getValues('email').length > 0)
        .with(FieldType.SIGNATURE, () => form.getValues('signature').length > 0)
        .otherwise(() => true);

      return { ...field, inserted, customText };
    }),
  );

  const onEmailInputBlur = () => {
    setLocalFields((prev) =>
      prev.map((field) => {
        if (field.type !== FieldType.EMAIL) {
          return field;
        }

        const value = form.getValues('email');

        return {
          ...field,
          customText: value,
          inserted: value.length > 0,
        };
      }),
    );
  };

  const onNameInputBlur = () => {
    setLocalFields((prev) =>
      prev.map((field) => {
        if (field.type !== FieldType.NAME) {
          return field;
        }

        const value = form.getValues('name');

        return {
          ...field,
          customText: value,
          inserted: value.length > 0,
        };
      }),
    );
  };

  const onSignatureInputChange = (value: string) => {
    setLocalFields((prev) =>
      prev.map((field) => {
        if (field.type !== FieldType.SIGNATURE) {
          return field;
        }

        return {
          ...field,
          value: value ?? '',
          inserted: true,
          Signature: {
            id: -1,
            recipientId: -1,
            fieldId: -1,
            created: new Date(),
            signatureImageAsBase64: value,
            typedSignature: null,
          },
        };
      }),
    );
  };

  return (
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
                      onBlur={() => {
                        field.onBlur();
                        onEmailInputBlur();
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
                        onBlur={() => {
                          field.onBlur();
                          onNameInputBlur();
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
                            onChange={(value) => {
                              field.onChange(value ?? '');
                              onSignatureInputChange(value ?? '');
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
          </div>
        </DocumentFlowFormContainerContent>

        <DocumentFlowFormContainerFooter>
          <DocumentFlowFormContainerStep
            title={documentFlow.title}
            step={documentFlow.stepIndex}
            maxStep={numberOfSteps}
          />

          <DocumentFlowFormContainerActions
            loading={form.formState.isSubmitting}
            disabled={form.formState.isSubmitting}
            onGoBackClick={documentFlow.onBackStep}
            onGoNextClick={async () => await form.handleSubmit(onSubmit)()}
          />
        </DocumentFlowFormContainerFooter>
      </fieldset>

      <ElementVisible target={PDF_VIEWER_PAGE_SELECTOR}>
        {localFields.map((field) =>
          match(field.type)
            .with(FieldType.DATE, FieldType.EMAIL, FieldType.NAME, () => {
              return <SinglePlayerModeCustomTextField key={field.id} field={field} />;
            })
            .with(FieldType.SIGNATURE, () => (
              <SinglePlayerModeSignatureField key={field.id} field={field} />
            ))
            .otherwise(() => {
              return null;
            }),
        )}
      </ElementVisible>
    </Form>
  );
};
