import { zodResolver } from '@hookform/resolvers/zod';
import { Trans } from '@lingui/react/macro';
import { DocumentDistributionMethod, DocumentSigningOrder, RecipientRole } from '@prisma/client';
import { nanoid } from 'nanoid';
import { useForm } from 'react-hook-form';

import { DEFAULT_DOCUMENT_DATE_FORMAT } from '@documenso/lib/constants/date-formats';
import { DEFAULT_DOCUMENT_TIME_ZONE } from '@documenso/lib/constants/time-zones';
import { ZDocumentEmailSettingsSchema } from '@documenso/lib/types/document-email';
import { Button } from '@documenso/ui/primitives/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@documenso/ui/primitives/form/form';
import { Input } from '@documenso/ui/primitives/input';

import { ConfigureDocumentAdvancedSettings } from './configure-document-advanced-settings';
import { useConfigureDocument } from './configure-document-context';
import { ConfigureDocumentRecipients } from './configure-document-recipients';
import { ConfigureDocumentUpload } from './configure-document-upload';
import {
  type TConfigureEmbedFormSchema,
  ZConfigureEmbedFormSchema,
  ZConfigureTemplateEmbedFormSchema,
} from './configure-document-view.types';

export interface ConfigureDocumentViewProps {
  type?: 'document' | 'template';
  onSubmit: (data: TConfigureEmbedFormSchema) => void | Promise<void>;
  defaultValues?: Partial<TConfigureEmbedFormSchema>;
  disableUpload?: boolean;
  isSubmitting?: boolean;
}

export const ConfigureDocumentView = ({
  type = 'document',
  onSubmit,
  defaultValues,
  disableUpload,
}: ConfigureDocumentViewProps) => {
  const { isTemplate } = useConfigureDocument();

  const form = useForm<TConfigureEmbedFormSchema>({
    resolver: zodResolver(
      type === 'template' ? ZConfigureTemplateEmbedFormSchema : ZConfigureEmbedFormSchema,
    ),
    defaultValues: {
      title: defaultValues?.title || '',
      signers: defaultValues?.signers || [
        {
          formId: nanoid(8),
          name: '',
          email: '',
          role: RecipientRole.SIGNER,
          signingOrder: 1,
          disabled: false,
        },
      ],
      meta: {
        subject: defaultValues?.meta?.subject || '',
        message: defaultValues?.meta?.message || '',
        distributionMethod:
          defaultValues?.meta?.distributionMethod || DocumentDistributionMethod.EMAIL,
        emailSettings: defaultValues?.meta?.emailSettings || ZDocumentEmailSettingsSchema.parse({}),
        dateFormat: defaultValues?.meta?.dateFormat || DEFAULT_DOCUMENT_DATE_FORMAT,
        timezone: defaultValues?.meta?.timezone || DEFAULT_DOCUMENT_TIME_ZONE,
        redirectUrl: defaultValues?.meta?.redirectUrl || '',
        language: defaultValues?.meta?.language || 'en',
        signatureTypes: defaultValues?.meta?.signatureTypes || [],
        signingOrder: defaultValues?.meta?.signingOrder || DocumentSigningOrder.PARALLEL,
        allowDictateNextSigner: defaultValues?.meta?.allowDictateNextSigner || false,
        externalId: defaultValues?.meta?.externalId || '',
      },
      documentData: defaultValues?.documentData,
    },
  });

  const { control, handleSubmit } = form;

  const isSubmitting = form.formState.isSubmitting;

  const onFormSubmit = handleSubmit(onSubmit);

  return (
    <div className="flex w-full flex-col space-y-8">
      <div>
        <h2 className="text-foreground mb-1 text-xl font-semibold">
          {isTemplate ? <Trans>Configure Template</Trans> : <Trans>Configure Document</Trans>}
        </h2>

        <p className="text-muted-foreground text-sm">
          {isTemplate ? (
            <Trans>Set up your template properties and recipient information</Trans>
          ) : (
            <Trans>Set up your document properties and recipient information</Trans>
          )}
        </p>
      </div>

      <Form {...form}>
        <div className="flex flex-col space-y-8">
          <div>
            <FormField
              control={control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>
                    <Trans>Title</Trans>
                  </FormLabel>
                  <FormControl>
                    <Input {...field} disabled={isSubmitting} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {!disableUpload && <ConfigureDocumentUpload isSubmitting={isSubmitting} />}
          <ConfigureDocumentRecipients control={control} isSubmitting={isSubmitting} />
          <ConfigureDocumentAdvancedSettings control={control} isSubmitting={isSubmitting} />

          <div className="flex justify-end">
            <Button
              type="button"
              onClick={onFormSubmit}
              disabled={isSubmitting}
              className="w-full sm:w-auto"
            >
              <Trans>Continue</Trans>
            </Button>
          </div>
        </div>
      </Form>
    </div>
  );
};
