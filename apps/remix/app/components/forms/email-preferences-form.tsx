import { zodResolver } from '@hookform/resolvers/zod';
import { Trans } from '@lingui/react/macro';
import type { TeamGlobalSettings } from '@prisma/client';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { FROM_ADDRESS } from '@documenso/lib/constants/email';
import {
  DEFAULT_DOCUMENT_EMAIL_SETTINGS,
  ZDocumentEmailSettingsSchema,
} from '@documenso/lib/types/document-email';
import { trpc } from '@documenso/trpc/react';
import { DocumentEmailCheckboxes } from '@documenso/ui/components/document/document-email-checkboxes';
import { Button } from '@documenso/ui/primitives/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@documenso/ui/primitives/form/form';
import { Input } from '@documenso/ui/primitives/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@documenso/ui/primitives/select';

const ZEmailPreferencesFormSchema = z.object({
  emailId: z.string().nullable(),
  emailReplyTo: z.string().email().nullable(),
  // emailReplyToName: z.string(),
  emailDocumentSettings: ZDocumentEmailSettingsSchema.nullable(),
});

export type TEmailPreferencesFormSchema = z.infer<typeof ZEmailPreferencesFormSchema>;

type SettingsSubset = Pick<
  TeamGlobalSettings,
  'emailId' | 'emailReplyTo' | 'emailDocumentSettings'
>;

export type EmailPreferencesFormProps = {
  settings: SettingsSubset;
  canInherit: boolean;
  onFormSubmit: (data: TEmailPreferencesFormSchema) => Promise<void>;
};

export const EmailPreferencesForm = ({
  settings,
  onFormSubmit,
  canInherit,
}: EmailPreferencesFormProps) => {
  const organisation = useCurrentOrganisation();

  const form = useForm<TEmailPreferencesFormSchema>({
    defaultValues: {
      emailId: settings.emailId,
      emailReplyTo: settings.emailReplyTo,
      // emailReplyToName: settings.emailReplyToName,
      emailDocumentSettings: settings.emailDocumentSettings,
    },
    resolver: zodResolver(ZEmailPreferencesFormSchema),
  });

  const { data: emailData, isLoading: isLoadingEmails } =
    trpc.enterprise.organisation.email.find.useQuery({
      organisationId: organisation.id,
      perPage: 100,
    });

  const emails = emailData?.data || [];

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onFormSubmit)}>
        <fieldset
          className="flex h-full max-w-2xl flex-col gap-y-6"
          disabled={form.formState.isSubmitting}
        >
          {organisation.organisationClaim.flags.emailDomains && (
            <FormField
              control={form.control}
              name="emailId"
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormLabel>
                    <Trans>Default Email</Trans>
                  </FormLabel>

                  <FormControl>
                    <Select
                      {...field}
                      value={field.value === null ? '-1' : field.value}
                      onValueChange={(value) => field.onChange(value === '-1' ? null : value)}
                    >
                      <SelectTrigger loading={isLoadingEmails}>
                        <SelectValue />
                      </SelectTrigger>

                      <SelectContent>
                        {emails.map((email) => (
                          <SelectItem key={email.id} value={email.id}>
                            {email.email}
                          </SelectItem>
                        ))}

                        <SelectItem value={'-1'}>
                          {canInherit ? <Trans>Inherit from organisation</Trans> : FROM_ADDRESS}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>

                  <FormDescription>
                    <Trans>The default email to use when sending emails to recipients</Trans>
                  </FormDescription>
                </FormItem>
              )}
            />
          )}

          <FormField
            control={form.control}
            name="emailReplyTo"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <Trans>Reply to email</Trans>
                </FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    value={field.value ?? ''}
                    onChange={(value) => field.onChange(value.target.value || null)}
                    placeholder="noreply@example.com"
                    type="email"
                  />
                </FormControl>
                <FormMessage />
                <FormDescription>
                  <Trans>
                    The email address which will show up in the "Reply To" field in emails
                  </Trans>

                  {canInherit && (
                    <span>
                      {'. '}
                      <Trans>Leave blank to inherit from the organisation.</Trans>
                    </span>
                  )}
                </FormDescription>
              </FormItem>
            )}
          />

          {/* <FormField
            control={form.control}
            name="emailReplyToName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <Trans>Reply to name</Trans>
                </FormLabel>
                <FormControl>
                  <Input {...field} value={field.value ?? ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          /> */}

          <FormField
            control={form.control}
            name="emailDocumentSettings"
            render={({ field }) => (
              <FormItem className="flex-1">
                <FormLabel>
                  <Trans>Default Email Settings</Trans>
                </FormLabel>
                {canInherit && (
                  <Select
                    value={field.value === null ? 'INHERIT' : 'CONTROLLED'}
                    onValueChange={(value) =>
                      field.onChange(
                        value === 'CONTROLLED' ? DEFAULT_DOCUMENT_EMAIL_SETTINGS : null,
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>

                    <SelectContent>
                      <SelectItem value={'INHERIT'}>
                        <Trans>Inherit from organisation</Trans>
                      </SelectItem>

                      <SelectItem value={'CONTROLLED'}>
                        <Trans>Override organisation settings</Trans>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                )}

                {field.value && (
                  <div className="space-y-2 rounded-md border p-4">
                    <DocumentEmailCheckboxes
                      value={field.value ?? DEFAULT_DOCUMENT_EMAIL_SETTINGS}
                      onChange={(value) => field.onChange(value)}
                    />
                  </div>
                )}

                <FormDescription>
                  <Trans>
                    Controls the default email settings when new documents or templates are created
                  </Trans>
                </FormDescription>
              </FormItem>
            )}
          />

          <div className="flex flex-row justify-end space-x-4">
            <Button type="submit" loading={form.formState.isSubmitting}>
              <Trans>Update</Trans>
            </Button>
          </div>
        </fieldset>
      </form>
    </Form>
  );
};
