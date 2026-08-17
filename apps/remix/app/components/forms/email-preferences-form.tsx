import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { useSession } from '@documenso/lib/client-only/providers/session';
import { FROM_ADDRESS } from '@documenso/lib/constants/email';
import { DEFAULT_DOCUMENT_EMAIL_SETTINGS, ZDocumentEmailSettingsSchema } from '@documenso/lib/types/document-email';
import { zEmail } from '@documenso/lib/utils/zod';
import { trpc } from '@documenso/trpc/react';
import { DocumentEmailCheckboxes } from '@documenso/ui/components/document/document-email-checkboxes';
import { Alert } from '@documenso/ui/primitives/alert';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@documenso/ui/primitives/select';
import { zodResolver } from '@hookform/resolvers/zod';
import { Trans } from '@lingui/react/macro';
import { OrganisationType, type TeamGlobalSettings } from '@prisma/client';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { FormStickySaveBar } from './form-sticky-save-bar';
import { InheritableField } from './inheritable-field';

const ZEmailPreferencesFormSchema = z.object({
  emailId: z.string().nullable(),
  emailReplyTo: zEmail().nullable(),
  // emailReplyToName: z.string(),
  emailDocumentSettings: ZDocumentEmailSettingsSchema.nullable(),
  includeSenderDetails: z.boolean().nullable(),
});

export type TEmailPreferencesFormSchema = z.infer<typeof ZEmailPreferencesFormSchema>;

type SettingsSubset = Pick<
  TeamGlobalSettings,
  'emailId' | 'emailReplyTo' | 'emailDocumentSettings' | 'includeSenderDetails'
>;

export type EmailPreferencesFormProps = {
  settings: SettingsSubset;
  canInherit: boolean;
  onFormSubmit: (data: TEmailPreferencesFormSchema) => Promise<void>;
};

export const EmailPreferencesForm = ({ settings, onFormSubmit, canInherit }: EmailPreferencesFormProps) => {
  const { user } = useSession();
  const organisation = useCurrentOrganisation();

  const isPersonalOrganisation = organisation.type === OrganisationType.PERSONAL;

  const placeholderEmail = user.email ?? 'user@example.com';

  const form = useForm<TEmailPreferencesFormSchema>({
    defaultValues: {
      emailId: settings.emailId,
      emailReplyTo: settings.emailReplyTo,
      // emailReplyToName: settings.emailReplyToName,
      emailDocumentSettings: settings.emailDocumentSettings,
      includeSenderDetails: settings.includeSenderDetails,
    },
    resolver: zodResolver(ZEmailPreferencesFormSchema),
  });

  const { data: emailData, isLoading: isLoadingEmails } = trpc.enterprise.organisation.email.find.useQuery({
    organisationId: organisation.id,
    perPage: 100,
  });

  const emails = emailData?.data || [];

  const handleFormSubmit = form.handleSubmit(async (data) => {
    try {
      await onFormSubmit(data);
    } catch {
      // The page handler surfaces its own error toast. Keep the form dirty so
      // the save bar stays visible and the user can retry.
      return;
    }

    form.reset(data);
  });

  return (
    <Form {...form}>
      <form onSubmit={handleFormSubmit}>
        <fieldset className="flex h-full flex-col gap-y-6" disabled={form.formState.isSubmitting}>
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
              <InheritableField
                canInherit={canInherit}
                isInherited={field.value === null}
                label={<Trans>Reply to email</Trans>}
                testId="email-reply-to"
              >
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
                  <Trans>The email address which will show up in the "Reply To" field in emails</Trans>

                  {canInherit && (
                    <span>
                      {'. '}
                      <Trans>Leave blank to inherit from the organisation.</Trans>
                    </span>
                  )}
                </FormDescription>
              </InheritableField>
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
              <InheritableField
                className="flex-1"
                canInherit={canInherit}
                isInherited={field.value === null}
                label={<Trans>Default Email Settings</Trans>}
                testId="email-document-settings"
              >
                {canInherit && (
                  <Select
                    value={field.value === null ? 'INHERIT' : 'CONTROLLED'}
                    onValueChange={(value) =>
                      field.onChange(value === 'CONTROLLED' ? DEFAULT_DOCUMENT_EMAIL_SETTINGS : null)
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
                    Controls the default email settings when new documents or templates are created. Updating these
                    settings will not affect existing documents or templates.
                  </Trans>
                </FormDescription>
              </InheritableField>
            )}
          />

          {!isPersonalOrganisation && (
            <FormField
              control={form.control}
              name="includeSenderDetails"
              render={({ field }) => (
                <InheritableField
                  className="flex-1"
                  canInherit={canInherit}
                  isInherited={field.value === null}
                  label={<Trans>Send on Behalf of Team</Trans>}
                  testId="include-sender-details"
                >
                  <FormControl>
                    <Select
                      {...field}
                      value={field.value === null ? '-1' : field.value.toString()}
                      onValueChange={(value) =>
                        field.onChange(value === 'true' ? true : value === 'false' ? false : null)
                      }
                    >
                      <SelectTrigger
                        className="bg-background text-muted-foreground"
                        data-testid="include-sender-details-trigger"
                      >
                        <SelectValue />
                      </SelectTrigger>

                      <SelectContent>
                        <SelectItem value="true">
                          <Trans>Yes</Trans>
                        </SelectItem>

                        <SelectItem value="false">
                          <Trans>No</Trans>
                        </SelectItem>

                        {canInherit && (
                          <SelectItem value={'-1'}>
                            <Trans>Inherit from organisation</Trans>
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </FormControl>

                  <div className="pt-2">
                    <div className="font-medium text-muted-foreground text-xs">
                      <Trans>Preview</Trans>
                    </div>

                    <Alert variant="neutral" className="mt-1 px-2.5 py-1.5 text-sm">
                      {field.value ? (
                        <Trans>
                          "{placeholderEmail}" on behalf of "Team Name" has invited you to sign "example document".
                        </Trans>
                      ) : (
                        <Trans>"Team Name" has invited you to sign "example document".</Trans>
                      )}
                    </Alert>
                  </div>

                  <FormDescription>
                    <Trans>
                      Controls the formatting of the message that will be sent when inviting a recipient to sign a
                      document. If a custom message has been provided while configuring the document, it will be used
                      instead.
                    </Trans>
                  </FormDescription>
                </InheritableField>
              )}
            />
          )}

          <FormStickySaveBar
            isDirty={form.formState.isDirty}
            isSubmitting={form.formState.isSubmitting}
            onReset={() => form.reset()}
          />
        </fieldset>
      </form>
    </Form>
  );
};
