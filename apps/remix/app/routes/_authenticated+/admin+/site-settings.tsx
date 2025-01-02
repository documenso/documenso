import { zodResolver } from '@hookform/resolvers/zod';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { useForm } from 'react-hook-form';
import { useRevalidator } from 'react-router';
import type { z } from 'zod';

import { getSiteSettings } from '@documenso/lib/server-only/site-settings/get-site-settings';
import {
  SITE_SETTINGS_BANNER_ID,
  ZSiteSettingsBannerSchema,
} from '@documenso/lib/server-only/site-settings/schemas/banner';
import { trpc as trpcReact } from '@documenso/trpc/react';
import { Button } from '@documenso/ui/primitives/button';
import { ColorPicker } from '@documenso/ui/primitives/color-picker';
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

import { SettingsHeader } from '~/components/general/settings-header';

import type { Route } from './+types/site-settings';

const ZBannerFormSchema = ZSiteSettingsBannerSchema;

type TBannerFormSchema = z.infer<typeof ZBannerFormSchema>;

export async function loader() {
  const banner = await getSiteSettings().then((settings) =>
    settings.find((setting) => setting.id === SITE_SETTINGS_BANNER_ID),
  );

  return { banner };
}

export default function AdminBannerPage({ loaderData }: Route.ComponentProps) {
  const { banner } = loaderData;

  const { toast } = useToast();
  const { _ } = useLingui();
  const { revalidate } = useRevalidator();

  const form = useForm<TBannerFormSchema>({
    resolver: zodResolver(ZBannerFormSchema),
    defaultValues: {
      id: SITE_SETTINGS_BANNER_ID,
      enabled: banner?.enabled ?? false,
      data: {
        content: banner?.data?.content ?? '',
        bgColor: banner?.data?.bgColor ?? '#000000',
        textColor: banner?.data?.textColor ?? '#FFFFFF',
      },
    },
  });

  const enabled = form.watch('enabled');

  const { mutateAsync: updateSiteSetting, isPending: isUpdateSiteSettingLoading } =
    trpcReact.admin.updateSiteSetting.useMutation();

  const onBannerUpdate = async ({ id, enabled, data }: TBannerFormSchema) => {
    try {
      await updateSiteSetting({
        id,
        enabled,
        data,
      });

      toast({
        title: _(msg`Banner Updated`),
        description: _(msg`Your banner has been updated successfully.`),
        duration: 5000,
      });

      await revalidate();
    } catch (err) {
      toast({
        title: _(msg`An unknown error occurred`),
        variant: 'destructive',
        description: _(
          msg`We encountered an unknown error while attempting to update the banner. Please try again later.`,
        ),
      });
    }
  };

  return (
    <div>
      <SettingsHeader
        title={_(msg`Site Settings`)}
        subtitle={_(msg`Manage your site settings here`)}
      />

      <div className="mt-8">
        <div>
          <h2 className="font-semibold">
            <Trans>Site Banner</Trans>
          </h2>
          <p className="text-muted-foreground mt-2 text-sm">
            <Trans>
              The site banner is a message that is shown at the top of the site. It can be used to
              display important information to your users.
            </Trans>
          </p>

          <Form {...form}>
            <form
              className="mt-4 flex flex-col rounded-md"
              onSubmit={form.handleSubmit(onBannerUpdate)}
            >
              <div className="mt-4 flex flex-col gap-4 md:flex-row">
                <FormField
                  control={form.control}
                  name="enabled"
                  render={({ field }) => (
                    <FormItem className="flex-1">
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

                <fieldset
                  className="flex flex-col gap-4 md:flex-row"
                  disabled={!enabled}
                  aria-disabled={!enabled}
                >
                  <FormField
                    control={form.control}
                    name="data.bgColor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          <Trans>Background Color</Trans>
                        </FormLabel>

                        <FormControl>
                          <div>
                            <ColorPicker {...field} />
                          </div>
                        </FormControl>

                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="data.textColor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          <Trans>Text Color</Trans>
                        </FormLabel>

                        <FormControl>
                          <div>
                            <ColorPicker {...field} />
                          </div>
                        </FormControl>

                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </fieldset>
              </div>

              <fieldset disabled={!enabled} aria-disabled={!enabled}>
                <FormField
                  control={form.control}
                  name="data.content"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        <Trans>Content</Trans>
                      </FormLabel>

                      <FormControl>
                        <Textarea className="h-32 resize-none" {...field} />
                      </FormControl>

                      <FormDescription>
                        <Trans>The content to show in the banner, HTML is allowed</Trans>
                      </FormDescription>

                      <FormMessage />
                    </FormItem>
                  )}
                />
              </fieldset>

              <Button
                type="submit"
                loading={isUpdateSiteSettingLoading}
                className="mt-4 justify-end self-end"
              >
                <Trans>Update Banner</Trans>
              </Button>
            </form>
          </Form>
        </div>
      </div>
    </div>
  );
}
