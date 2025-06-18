import { zodResolver } from '@hookform/resolvers/zod';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react/macro';
import { Trans } from '@lingui/react/macro';
import type { TeamGlobalSettings } from '@prisma/client';
import { DocumentVisibility } from '@prisma/client';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { useSession } from '@documenso/lib/client-only/providers/session';
import { DOCUMENT_SIGNATURE_TYPES, DocumentSignatureType } from '@documenso/lib/constants/document';
import { SUPPORTED_LANGUAGE_CODES, isValidLanguageCode } from '@documenso/lib/constants/i18n';
import { isPersonalLayout } from '@documenso/lib/utils/organisations';
import { extractTeamSignatureSettings } from '@documenso/lib/utils/teams';
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
import { MultiSelectCombobox } from '@documenso/ui/primitives/multi-select-combobox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@documenso/ui/primitives/select';

/**
 * Can't infer this from the schema since we need to keep the schema inside the component to allow
 * it to be dynamic.
 */
export type TEmailPreferencesFormSchema = {
  documentVisibility: DocumentVisibility | null;
  documentLanguage: (typeof SUPPORTED_LANGUAGE_CODES)[number] | null;
  includeSenderDetails: boolean | null;
  includeSigningCertificate: boolean | null;
  signatureTypes: DocumentSignatureType[];
};

type SettingsSubset = Pick<
  TeamGlobalSettings,
  | 'documentVisibility'
  | 'documentLanguage'
  | 'includeSenderDetails'
  | 'includeSigningCertificate'
  | 'typedSignatureEnabled'
  | 'uploadSignatureEnabled'
  | 'drawSignatureEnabled'
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
  const { t } = useLingui();
  const { user, organisations } = useSession();

  const organisation = useCurrentOrganisation();
  const isPersonalLayoutMode = isPersonalLayout(organisations);

  const placeholderEmail = user.email ?? 'user@example.com';

  const ZEmailPreferencesFormSchema = z.object({
    documentVisibility: z.nativeEnum(DocumentVisibility).nullable(),
    documentLanguage: z.enum(SUPPORTED_LANGUAGE_CODES).nullable(),
    includeSenderDetails: z.boolean().nullable(),
    includeSigningCertificate: z.boolean().nullable(),
    signatureTypes: z.array(z.nativeEnum(DocumentSignatureType)).min(canInherit ? 0 : 1, {
      message: msg`At least one signature type must be enabled`.id,
    }),
  });

  const form = useForm<TEmailPreferencesFormSchema>({
    defaultValues: {
      documentVisibility: settings.documentVisibility,
      documentLanguage: isValidLanguageCode(settings.documentLanguage)
        ? settings.documentLanguage
        : null,
      includeSenderDetails: settings.includeSenderDetails,
      includeSigningCertificate: settings.includeSigningCertificate,
      signatureTypes: extractTeamSignatureSettings({ ...settings }),
    },
    resolver: zodResolver(ZEmailPreferencesFormSchema),
  });

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
              name="documentVisibility"
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
                      <SelectTrigger className="bg-background text-muted-foreground">
                        <SelectValue />
                      </SelectTrigger>

                      <SelectContent>
                        <SelectItem value={DocumentVisibility.EVERYONE}>
                          <Trans>demo@demo.com</Trans>
                        </SelectItem>
                        <SelectItem value={DocumentVisibility.MANAGER_AND_ABOVE}>
                          <Trans>foo@bar.com</Trans>
                        </SelectItem>
                        <SelectItem value={DocumentVisibility.ADMIN}>
                          <Trans>None - Use default Documenso email</Trans>
                        </SelectItem>

                        {canInherit && (
                          <SelectItem value={'-1'}>
                            <Trans>Inherit from organisation</Trans>
                          </SelectItem>
                        )}
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
            name="documentLanguage"
            render={({ field }) => (
              <FormItem className="flex-1">
                <FormLabel>
                  <Trans>Default Email Settings</Trans>
                </FormLabel>
                <div className="space-y-2 rounded-md border p-4">
                  <DocumentEmailCheckboxes
                    value={{}}
                    // value={emailSettings}
                    // onChange={(value) => setValue('meta.emailSettings', value)}
                  />
                </div>

                <FormDescription>
                  <Trans>
                    Controls the default email settings when new documents or templates are created
                  </Trans>
                </FormDescription>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="signatureTypes"
            render={({ field }) => (
              <FormItem className="flex-1">
                <FormLabel>
                  <Trans>Allowed emails</Trans>
                </FormLabel>

                <FormControl>
                  <MultiSelectCombobox
                    options={Object.values(DOCUMENT_SIGNATURE_TYPES).map((option) => ({
                      label: t(option.label),
                      value: option.value,
                    }))}
                    selectedValues={field.value}
                    onChange={field.onChange}
                    className="bg-background w-full"
                    enableSearch={false}
                    emptySelectionPlaceholder={
                      canInherit ? t`Inherit from organisation` : t`Select signature types`
                    }
                    testId="signature-types-combobox"
                  />
                </FormControl>

                <FormMessage />
                <FormDescription>
                  <Trans>
                    Controls which emails are allowed to be selected when sending emails to
                    recipients.
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
