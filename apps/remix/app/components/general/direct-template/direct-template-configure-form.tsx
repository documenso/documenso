import { zodResolver } from '@hookform/resolvers/zod';
import { Trans } from '@lingui/react/macro';
import type { Recipient } from '@prisma/client';
import type { Field } from '@prisma/client';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { useOptionalSession } from '@documenso/lib/client-only/providers/session';
import type { TTemplate } from '@documenso/lib/types/template';
import {
  DocumentReadOnlyFields,
  mapFieldsWithRecipients,
} from '@documenso/ui/components/document/document-read-only-fields';
import {
  DocumentFlowFormContainerActions,
  DocumentFlowFormContainerContent,
  DocumentFlowFormContainerFooter,
  DocumentFlowFormContainerHeader,
  DocumentFlowFormContainerStep,
} from '@documenso/ui/primitives/document-flow/document-flow-root';
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

import { useRequiredDocumentSigningAuthContext } from '~/components/general/document-signing/document-signing-auth-provider';

const ZDirectTemplateConfigureFormSchema = z.object({
  email: z.string().email('Email is invalid'),
});

export type TDirectTemplateConfigureFormSchema = z.infer<typeof ZDirectTemplateConfigureFormSchema>;

export type DirectTemplateConfigureFormProps = {
  flowStep: DocumentFlowStep;
  isDocumentPdfLoaded: boolean;
  template: Omit<TTemplate, 'user'>;
  directTemplateRecipient: Recipient & { fields: Field[] };
  initialEmail?: string;
  onSubmit: (_data: TDirectTemplateConfigureFormSchema) => void;
};

export const DirectTemplateConfigureForm = ({
  flowStep,
  isDocumentPdfLoaded,
  template,
  directTemplateRecipient,
  initialEmail,
  onSubmit,
}: DirectTemplateConfigureFormProps) => {
  const { sessionData } = useOptionalSession();
  const user = sessionData?.user;

  const { recipients } = template;
  const { derivedRecipientAccessAuth } = useRequiredDocumentSigningAuthContext();

  const recipientsWithBlankDirectRecipientEmail = recipients.map((recipient) => {
    if (recipient.id === directTemplateRecipient.id) {
      return {
        ...recipient,
        email: '',
      };
    }

    return recipient;
  });

  const form = useForm<TDirectTemplateConfigureFormSchema>({
    resolver: zodResolver(ZDirectTemplateConfigureFormSchema),
    defaultValues: {
      email: initialEmail || '',
    },
  });

  const { stepIndex, currentStep, totalSteps, previousStep } = useStep();

  return (
    <>
      <DocumentFlowFormContainerHeader title={flowStep.title} description={flowStep.description} />

      <DocumentFlowFormContainerContent>
        {isDocumentPdfLoaded && (
          <DocumentReadOnlyFields
            fields={mapFieldsWithRecipients(
              directTemplateRecipient.fields,
              recipientsWithBlankDirectRecipientEmail,
            )}
            recipientIds={recipients.map((recipient) => recipient.id)}
            showRecipientColors={true}
          />
        )}

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
                        derivedRecipientAccessAuth.length > 0 ||
                        user?.email !== undefined
                      }
                      placeholder="recipient@documenso.com"
                    />
                  </FormControl>

                  {!fieldState.error && (
                    <p className="text-xs text-muted-foreground">
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
