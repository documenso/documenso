import { zodResolver } from '@hookform/resolvers/zod';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { Loader } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useParams, useRevalidator } from 'react-router';
import type { z } from 'zod';

import { trpc } from '@documenso/trpc/react';
import { ZEditWebhookMutationSchema } from '@documenso/trpc/server/webhook-router/schema';
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
import { PasswordInput } from '@documenso/ui/primitives/password-input';
import { Switch } from '@documenso/ui/primitives/switch';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { SettingsHeader } from '~/components/general/settings-header';
import { WebhookMultiSelectCombobox } from '~/components/general/webhook-multiselect-combobox';

const ZEditWebhookFormSchema = ZEditWebhookMutationSchema.omit({ id: true });

type TEditWebhookFormSchema = z.infer<typeof ZEditWebhookFormSchema>;

export default function WebhookPage() {
  const params = useParams();

  const { _ } = useLingui();
  const { toast } = useToast();
  const { revalidate } = useRevalidator();

  const webhookId = params.id || '';

  const { data: webhook, isLoading } = trpc.webhook.getWebhookById.useQuery(
    {
      id: webhookId,
    },
    { enabled: !!webhookId },
  );

  const { mutateAsync: updateWebhook } = trpc.webhook.editWebhook.useMutation();

  const form = useForm<TEditWebhookFormSchema>({
    resolver: zodResolver(ZEditWebhookFormSchema),
    values: {
      webhookUrl: webhook?.webhookUrl ?? '',
      eventTriggers: webhook?.eventTriggers ?? [],
      secret: webhook?.secret ?? '',
      enabled: webhook?.enabled ?? true,
    },
  });

  const onSubmit = async (data: TEditWebhookFormSchema) => {
    try {
      await updateWebhook({
        id: webhookId,
        ...data,
      });

      toast({
        title: _(msg`Webhook updated`),
        description: _(msg`The webhook has been updated successfully.`),
        duration: 5000,
      });

      await revalidate();
    } catch (err) {
      toast({
        title: _(msg`Failed to update webhook`),
        description: _(
          msg`We encountered an error while updating the webhook. Please try again later.`,
        ),
        variant: 'destructive',
      });
    }
  };

  return (
    <div>
      <SettingsHeader
        title={_(msg`Edit webhook`)}
        subtitle={_(msg`On this page, you can edit the webhook and its settings.`)}
      />

      {isLoading && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/50">
          <Loader className="h-8 w-8 animate-spin text-gray-500" />
        </div>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <fieldset
            className="flex h-full max-w-xl flex-col gap-y-6"
            disabled={form.formState.isSubmitting}
          >
            <div className="flex flex-col-reverse gap-4 md:flex-row">
              <FormField
                control={form.control}
                name="webhookUrl"
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel required>
                      <Trans>Webhook URL</Trans>
                    </FormLabel>
                    <FormControl>
                      <Input className="bg-background" {...field} />
                    </FormControl>

                    <FormDescription>
                      <Trans>The URL for Documenso to send webhook events to.</Trans>
                    </FormDescription>

                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="enabled"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      <Trans>Enabled</Trans>
                    </FormLabel>

                    <div>
                      <FormControl>
                        <Switch
                          className="bg-background"
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </div>

                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="eventTriggers"
              render={({ field: { onChange, value } }) => (
                <FormItem className="flex flex-col gap-2">
                  <FormLabel required>
                    <Trans>Triggers</Trans>
                  </FormLabel>
                  <FormControl>
                    <WebhookMultiSelectCombobox
                      listValues={value}
                      onChange={(values: string[]) => {
                        onChange(values);
                      }}
                    />
                  </FormControl>

                  <FormDescription>
                    <Trans> The events that will trigger a webhook to be sent to your URL.</Trans>
                  </FormDescription>

                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="secret"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    <Trans>Secret</Trans>
                  </FormLabel>
                  <FormControl>
                    <PasswordInput className="bg-background" {...field} value={field.value ?? ''} />
                  </FormControl>

                  <FormDescription>
                    <Trans>
                      A secret that will be sent to your URL so you can verify that the request has
                      been sent by Documenso.
                    </Trans>
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="mt-4">
              <Button type="submit" loading={form.formState.isSubmitting}>
                <Trans>Update webhook</Trans>
              </Button>
            </div>
          </fieldset>
        </form>
      </Form>
    </div>
  );
}
