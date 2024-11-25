'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Trans, msg } from '@lingui/macro';
import { useLingui } from '@lingui/react';
import { useSession } from 'next-auth/react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import {
  SUPPORTED_LANGUAGES,
  SUPPORTED_LANGUAGE_CODES,
  isValidLanguageCode,
} from '@documenso/lib/constants/i18n';
import type { Team, TeamGlobalSettings } from '@documenso/prisma/client';
import { DocumentVisibility } from '@documenso/prisma/client';
import { trpc } from '@documenso/trpc/react';
import { Alert } from '@documenso/ui/primitives/alert';
import { Button } from '@documenso/ui/primitives/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from '@documenso/ui/primitives/form/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@documenso/ui/primitives/select';
import { Switch } from '@documenso/ui/primitives/switch';
import { useToast } from '@documenso/ui/primitives/use-toast';

const ZTeamDocumentPreferencesFormSchema = z.object({
  documentVisibility: z.nativeEnum(DocumentVisibility),
  documentLanguage: z.enum(SUPPORTED_LANGUAGE_CODES),
  includeSenderDetails: z.boolean(),
  includeSigningCertificate: z.boolean(),
});

type TTeamDocumentPreferencesFormSchema = z.infer<typeof ZTeamDocumentPreferencesFormSchema>;

export type TeamDocumentPreferencesFormProps = {
  team: Team;
  settings?: TeamGlobalSettings | null;
};

export const TeamDocumentPreferencesForm = ({
  team,
  settings,
}: TeamDocumentPreferencesFormProps) => {
  const { _ } = useLingui();
  const { toast } = useToast();
  const { data } = useSession();

  const placeholderEmail = data?.user.email ?? 'user@example.com';

  const { mutateAsync: updateTeamDocumentPreferences } =
    trpc.team.updateTeamDocumentSettings.useMutation();

  const form = useForm<TTeamDocumentPreferencesFormSchema>({
    defaultValues: {
      documentVisibility: settings?.documentVisibility ?? 'EVERYONE',
      documentLanguage: isValidLanguageCode(settings?.documentLanguage)
        ? settings?.documentLanguage
        : 'en',
      includeSenderDetails: settings?.includeSenderDetails ?? false,
      includeSigningCertificate: settings?.includeSigningCertificate ?? true,
    },
    resolver: zodResolver(ZTeamDocumentPreferencesFormSchema),
  });

  const includeSenderDetails = form.watch('includeSenderDetails');

  const onSubmit = async (data: TTeamDocumentPreferencesFormSchema) => {
    try {
      const {
        documentVisibility,
        documentLanguage,
        includeSenderDetails,
        includeSigningCertificate,
      } = data;

      await updateTeamDocumentPreferences({
        teamId: team.id,
        settings: {
          documentVisibility,
          documentLanguage,
          includeSenderDetails,
          includeSigningCertificate,
        },
      });

      toast({
        title: _(msg`Document preferences updated`),
        description: _(msg`Your document preferences have been updated`),
      });
    } catch (err) {
      toast({
        title: _(msg`Something went wrong!`),
        description: _(
          msg`We were unable to update your document preferences at this time, please try again later`,
        ),
      });
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <fieldset
          className="flex h-full max-w-xl flex-col gap-y-4"
          disabled={form.formState.isSubmitting}
        >
          <FormField
            control={form.control}
            name="documentVisibility"
            render={({ field }) => (
              <FormItem className="flex-1">
                <FormLabel>
                  <Trans>Default Document Visibility</Trans>
                </FormLabel>

                <FormControl>
                  <Select {...field} onValueChange={field.onChange}>
                    <SelectTrigger className="bg-background text-muted-foreground">
                      <SelectValue />
                    </SelectTrigger>

                    <SelectContent>
                      <SelectItem value={DocumentVisibility.EVERYONE}>
                        <Trans>Everyone can access and view the document</Trans>
                      </SelectItem>
                      <SelectItem value={DocumentVisibility.MANAGER_AND_ABOVE}>
                        <Trans>Only managers and above can access and view the document</Trans>
                      </SelectItem>
                      <SelectItem value={DocumentVisibility.ADMIN}>
                        <Trans>Only admins can access and view the document</Trans>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </FormControl>

                <FormDescription>
                  <Trans>Controls the default visibility of an uploaded document.</Trans>
                </FormDescription>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="documentLanguage"
            render={({ field }) => (
              <FormItem className="flex-1">
                <FormLabel>
                  <Trans>Default Document Language</Trans>
                </FormLabel>

                <FormControl>
                  <Select {...field} onValueChange={field.onChange}>
                    <SelectTrigger className="bg-background text-muted-foreground">
                      <SelectValue />
                    </SelectTrigger>

                    <SelectContent>
                      {Object.entries(SUPPORTED_LANGUAGES).map(([code, language]) => (
                        <SelectItem key={code} value={code}>
                          {language.full}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormControl>

                <FormDescription>
                  <Trans>
                    Controls the default language of an uploaded document. This will be used as the
                    language in email communications with the recipients.
                  </Trans>
                </FormDescription>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="includeSenderDetails"
            render={({ field }) => (
              <FormItem className="flex-1">
                <FormLabel>
                  <Trans>Send on Behalf of Team</Trans>
                </FormLabel>

                <div>
                  <FormControl className="block">
                    <Switch
                      ref={field.ref}
                      name={field.name}
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </div>

                <div className="pt-2">
                  <div className="text-muted-foreground text-xs font-medium">
                    <Trans>Preview</Trans>
                  </div>

                  <Alert variant="neutral" className="mt-1 px-2.5 py-1.5 text-sm">
                    {includeSenderDetails ? (
                      <Trans>
                        "{placeholderEmail}" on behalf of "{team.name}" has invited you to sign
                        "example document".
                      </Trans>
                    ) : (
                      <Trans>"{team.name}" has invited you to sign "example document".</Trans>
                    )}
                  </Alert>
                </div>

                <FormDescription>
                  <Trans>
                    Controls the formatting of the message that will be sent when inviting a
                    recipient to sign a document. If a custom message has been provided while
                    configuring the document, it will be used instead.
                  </Trans>
                </FormDescription>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="includeSigningCertificate"
            render={({ field }) => (
              <FormItem className="flex-1">
                <FormLabel>
                  <Trans>Include the Signing Certificate in the Document</Trans>
                </FormLabel>

                <div>
                  <FormControl className="block">
                    <Switch
                      ref={field.ref}
                      name={field.name}
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </div>

                <FormDescription>
                  <Trans>
                    Controls whether the signing certificate will be included in the document when
                    it is downloaded. The signing certificate can still be downloaded from the logs
                    page separately.
                  </Trans>
                </FormDescription>
              </FormItem>
            )}
          />

          <div className="flex flex-row justify-end space-x-4">
            <Button type="submit" loading={form.formState.isSubmitting}>
              <Trans>Save</Trans>
            </Button>
          </div>
        </fieldset>
      </form>
    </Form>
  );
};
