'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Trans, msg } from '@lingui/macro';
import { useLingui } from '@lingui/react';
import { useSession } from 'next-auth/react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import type { TTemplate } from '@documenso/lib/types/template';
import type { Recipient } from '@documenso/prisma/client';
import type { Field } from '@documenso/prisma/client';
import {
  DocumentFlowFormContainerActions,
  DocumentFlowFormContainerContent,
  DocumentFlowFormContainerFooter,
  DocumentFlowFormContainerHeader,
  DocumentFlowFormContainerStep,
} from '@documenso/ui/primitives/document-flow/document-flow-root';
import { ShowFieldItem } from '@documenso/ui/primitives/document-flow/show-field-item';
import type { DocumentFlowStep } from '@documenso/ui/primitives/document-flow/types';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@documenso/ui/primitives/form/form';
import { Input } from '@documenso/ui/primitives/input';
import { useStep } from '@documenso/ui/primitives/stepper';

import { useRequiredDocumentAuthContext } from '~/app/(signing)/sign/[token]/document-auth-provider';

const ZConfigureDirectTemplateFormSchema = z.object({
  email: z.string().email('Email is invalid'),
});

export type TConfigureDirectTemplateFormSchema = z.infer<typeof ZConfigureDirectTemplateFormSchema>;

export type ConfigureDirectTemplateFormProps = {
  flowStep: DocumentFlowStep;
  isDocumentPdfLoaded: boolean;
  template: Omit<TTemplate, 'user'>;
  directTemplateRecipient: Recipient & { fields: Field[] };
  initialEmail?: string;
  onSubmit: (_data: TConfigureDirectTemplateFormSchema) => void;
};

export const ConfigureDirectTemplateFormPartial = ({
  flowStep,
  isDocumentPdfLoaded,
  template,
  directTemplateRecipient,
  initialEmail,
  onSubmit,
}: ConfigureDirectTemplateFormProps) => {
  const { _ } = useLingui();
  const { data: session } = useSession();

  const { recipients } = template;
  const { derivedRecipientAccessAuth } = useRequiredDocumentAuthContext();

  const recipientsWithBlankDirectRecipientEmail = recipients.map((recipient) => {
    if (recipient.id === directTemplateRecipient.id) {
      return {
        ...recipient,
        email: '',
      };
    }

    return recipient;
  });

  const form = useForm<TConfigureDirectTemplateFormSchema>({
    resolver: zodResolver(
      ZConfigureDirectTemplateFormSchema.superRefine((items, ctx) => {
        if (template.recipients.map((recipient) => recipient.email).includes(items.email)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: _(msg`Email cannot already exist in the template`),
            path: ['email'],
          });
        }
      }),
    ),
    defaultValues: {
      email: initialEmail || '',
    },
  });

  const { stepIndex, currentStep, totalSteps, previousStep } = useStep();

  return (
    <>
      <DocumentFlowFormContainerHeader title={flowStep.title} description={flowStep.description} />

      <DocumentFlowFormContainerContent>
        {isDocumentPdfLoaded &&
          directTemplateRecipient.fields.map((field, index) => (
            <ShowFieldItem
              key={index}
              field={field}
              recipients={recipientsWithBlankDirectRecipientEmail}
            />
          ))}

        <Form {...form}>
          <fieldset
            className="flex h-full flex-col space-y-6"
            disabled={form.formState.isSubmitting}
          >
            <FormField
              control={form.control}
              name="email"
              render={({ field, fieldState }) => (
                <FormItem>
                  <FormLabel required>
                    <Trans>Email</Trans>
                  </FormLabel>

                  <FormControl>
                    <Input
                      {...field}
                      disabled={
                        field.disabled ||
                        derivedRecipientAccessAuth !== null ||
                        session?.user.email !== undefined
                      }
                      placeholder="recipient@documenso.com"
                    />
                  </FormControl>

                  {!fieldState.error && (
                    <p className="text-muted-foreground text-xs">
                      <Trans>Enter your email address to receive the completed document.</Trans>
                    </p>
                  )}

                  <FormMessage />
                </FormItem>
              )}
            />
          </fieldset>
        </Form>
      </DocumentFlowFormContainerContent>

      <DocumentFlowFormContainerFooter>
        <DocumentFlowFormContainerStep step={currentStep} maxStep={totalSteps} />

        <DocumentFlowFormContainerActions
          loading={form.formState.isSubmitting}
          disabled={form.formState.isSubmitting}
          canGoBack={stepIndex !== 0}
          onGoBackClick={previousStep}
          onGoNextClick={form.handleSubmit(onSubmit)}
        />
      </DocumentFlowFormContainerFooter>
    </>
  );
};
