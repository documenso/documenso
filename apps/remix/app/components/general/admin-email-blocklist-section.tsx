import {
  SITE_SETTINGS_EMAIL_BLOCKLIST_ID,
  type TSiteSettingsEmailBlocklistSchema,
} from '@documenso/lib/server-only/site-settings/schemas/email-blocklist';
import { trpc as trpcReact } from '@documenso/trpc/react';
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
import { Switch } from '@documenso/ui/primitives/switch';
import { Textarea } from '@documenso/ui/primitives/textarea';
import { useToast } from '@documenso/ui/primitives/use-toast';
import { zodResolver } from '@hookform/resolvers/zod';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { useForm } from 'react-hook-form';
import { useRevalidator } from 'react-router';
import { z } from 'zod';

const ZEmailBlocklistFormSchema = z.object({
  enabled: z.boolean(),
  domains: z.string(),
});

type TEmailBlocklistFormSchema = z.infer<typeof ZEmailBlocklistFormSchema>;

/**
 * Splits a comma-separated string into a normalised list of domains.
 * Normalisation (trim, lowercase, strip leading "@", dedupe) is applied
 * server-side by the schema as well — this is for display consistency.
 */
const parseDomainsInput = (value: string): string[] => {
  return Array.from(
    new Set(
      value
        .split(',')
        .map((entry) => entry.trim().toLowerCase().replace(/^@/, ''))
        .filter((entry) => entry.length > 0),
    ),
  );
};

type AdminEmailBlocklistSectionProps = {
  emailBlocklist: TSiteSettingsEmailBlocklistSchema | undefined;
};

export const AdminEmailBlocklistSection = ({ emailBlocklist }: AdminEmailBlocklistSectionProps) => {
  const { toast } = useToast();
  const { _ } = useLingui();
  const { revalidate } = useRevalidator();

  const form = useForm<TEmailBlocklistFormSchema>({
    resolver: zodResolver(ZEmailBlocklistFormSchema),
    defaultValues: {
      enabled: emailBlocklist?.enabled ?? false,
      domains: (emailBlocklist?.data?.domains ?? []).join(', '),
    },
  });

  const enabled = form.watch('enabled');

  const { mutateAsync: updateSiteSetting, isPending: isUpdateSiteSettingLoading } =
    trpcReact.admin.updateSiteSetting.useMutation();

  const onBlocklistUpdate = async ({ enabled, domains }: TEmailBlocklistFormSchema) => {
    try {
      const parsedDomains = parseDomainsInput(domains);

      await updateSiteSetting({
        id: SITE_SETTINGS_EMAIL_BLOCKLIST_ID,
        enabled,
        data: {
          domains: parsedDomains,
        },
      });

      // Reflect the normalised value back in the form.
      form.reset({
        enabled,
        domains: parsedDomains.join(', '),
      });

      toast({
        title: _(msg`Email Blocklist Updated`),
        description: _(msg`The email blocklist has been updated successfully.`),
        duration: 5000,
      });

      await revalidate();
    } catch (err) {
      toast({
        title: _(msg`An unknown error occurred`),
        variant: 'destructive',
        description: _(
          msg`We encountered an unknown error while attempting to update the email blocklist. Please try again later.`,
        ),
      });
    }
  };

  return (
    <div>
      <h2 className="font-semibold">
        <Trans>Email Blocklist</Trans>
      </h2>
      <p className="mt-2 text-muted-foreground text-sm">
        <Trans>
          Block signups from additional email domains on top of the bundled disposable email list. Subdomains are
          matched automatically (e.g. blocking "bad.com" also blocks "foo.bad.com").
        </Trans>
      </p>

      <Form {...form}>
        <form className="mt-4 flex flex-col rounded-md" onSubmit={form.handleSubmit(onBlocklistUpdate)}>
          <FormField
            control={form.control}
            name="enabled"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <Trans>Enabled</Trans>
                </FormLabel>

                <FormControl>
                  <div>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </div>
                </FormControl>
              </FormItem>
            )}
          />

          <fieldset className="mt-4" disabled={!enabled} aria-disabled={!enabled}>
            <FormField
              control={form.control}
              name="domains"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    <Trans>Blocked Domains</Trans>
                  </FormLabel>

                  <FormControl>
                    <Textarea className="h-32 resize-none" placeholder="bad.com, spam.net, throwaway.io" {...field} />
                  </FormControl>

                  <FormDescription>
                    <Trans>Comma-separated list of email domains to block from signing up.</Trans>
                  </FormDescription>

                  <FormMessage />
                </FormItem>
              )}
            />
          </fieldset>

          <Button type="submit" loading={isUpdateSiteSettingLoading} className="mt-4 justify-end self-end">
            <Trans>Update Blocklist</Trans>
          </Button>
        </form>
      </Form>
    </div>
  );
};
