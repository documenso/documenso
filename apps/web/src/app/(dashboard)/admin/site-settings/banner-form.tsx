'use client';

import { useRouter } from 'next/navigation';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';

import type { TSiteSettingsBannerSchema } from '@documenso/lib/server-only/site-settings/schemas/banner';
import {
  SITE_SETTINGS_BANNER_ID,
  ZSiteSettingsBannerSchema,
} from '@documenso/lib/server-only/site-settings/schemas/banner';
import { TRPCClientError } from '@documenso/trpc/client';
import { trpc as trpcReact } from '@documenso/trpc/react';
import { Button } from '@documenso/ui/primitives/button';
import { ColorPicker } from '@documenso/ui/primitives/color-picker';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@documenso/ui/primitives/form/form';
import { Switch } from '@documenso/ui/primitives/switch';
import { Textarea } from '@documenso/ui/primitives/textarea';
import { useToast } from '@documenso/ui/primitives/use-toast';

const ZBannerFormSchema = ZSiteSettingsBannerSchema;

type TBannerFormSchema = z.infer<typeof ZBannerFormSchema>;

export type BannerFormProps = {
  banner?: TSiteSettingsBannerSchema;
};

export function BannerForm({ banner }: BannerFormProps) {
  const router = useRouter();
  const { toast } = useToast();

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

  const { mutateAsync: updateSiteSetting, isLoading: isUpdateSiteSettingLoading } =
    trpcReact.admin.updateSiteSetting.useMutation();

  const onBannerUpdate = async ({ id, enabled, data }: TBannerFormSchema) => {
    try {
      await updateSiteSetting({
        id,
        enabled,
        data,
      });

      toast({
        title: 'ბანერი განახლებულია',
        description: 'ბანერი წარმატებით განახლდა.',
        duration: 5000,
      });

      router.refresh();
    } catch (err) {
      if (err instanceof TRPCClientError && err.data?.code === 'BAD_REQUEST') {
        toast({
          title: 'დაფიქსირდა ხარვეზი',
          description: err.message,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'დაფიქსირდა ხარვეზი',
          variant: 'destructive',
          description:
            'ბანერის განახლებისას დაფიქსირდა ხარვეზი. გთხოვთ თავიდან სცადოთ ან დაგვიკავშირდეთ.',
        });
      }
    }
  };

  return (
    <div>
      <h2 className="font-semibold">ბანერი</h2>
      <p className="text-muted-foreground mt-2 text-sm">
        საიტის ბანერი არის შეტყობინება, რომელიც ნაჩვენებია ვებგვერდის ზედა ნაწილში. ის შეიძლება
        გამოყენებულ იქნას თქვენი მომხმარებლებისთვის მნიშვნელოვანი ინფორმაციის საჩვენებლად.
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
                  <FormLabel>გააქტიურებულია</FormLabel>

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
                    <FormLabel>ფონის ფერი</FormLabel>

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
                    <FormLabel>ტექსტის ფერი</FormLabel>

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
                  <FormLabel>Content</FormLabel>

                  <FormControl>
                    <Textarea className="h-32 resize-none" {...field} />
                  </FormControl>

                  {/* <FormDescription>
                    The content to show in the banner, HTML is allowed
                  </FormDescription> */}

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
            ბანერის განახლება
          </Button>
        </form>
      </Form>
    </div>
  );
}
