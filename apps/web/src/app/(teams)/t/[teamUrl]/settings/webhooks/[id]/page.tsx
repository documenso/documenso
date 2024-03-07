'use client';

import { useRouter } from 'next/navigation';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader } from 'lucide-react';
import { useForm } from 'react-hook-form';
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

import { SettingsHeader } from '~/components/(dashboard)/settings/layout/header';
import { TriggerMultiSelectCombobox } from '~/components/(dashboard)/settings/webhooks/trigger-multiselect-combobox';
import { useCurrentTeam } from '~/providers/team';

const ZEditWebhookFormSchema = ZEditWebhookMutationSchema.omit({ id: true });

type TEditWebhookFormSchema = z.infer<typeof ZEditWebhookFormSchema>;

export type WebhookPageOptions = {
  params: {
    id: string;
  };
};

export default function WebhookPage({ params }: WebhookPageOptions) {
  const { toast } = useToast();
  const router = useRouter();

  const team = useCurrentTeam();

  const { data: webhook, isLoading } = trpc.webhook.getWebhookById.useQuery(
    {
      id: params.id,
      teamId: team.id,
    },
    { enabled: !!params.id && !!team.id },
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
        id: params.id,
        teamId: team.id,
        ...data,
      });

      toast({
        title: 'Webhook updated',
        description: 'The webhook has been updated successfully.',
        duration: 5000,
      });

      router.refresh();
    } catch (err) {
      toast({
        title: 'Failed to update webhook',
        description: 'We encountered an error while updating the webhook. Please try again later.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div>
      <SettingsHeader
        title="Edit webhook"
        subtitle="On this page, you can edit the webhook and its settings."
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
                    <FormLabel required>Webhook URL</FormLabel>
                    <FormControl>
                      <Input className="bg-background" {...field} />
                    </FormControl>

                    <FormDescription>
                      The URL for Documenso to send webhook events to.
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
                    <FormLabel>Enabled</FormLabel>

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
                  <FormLabel required>Triggers</FormLabel>
                  <FormControl>
                    <TriggerMultiSelectCombobox
                      listValues={value}
                      onChange={(values: string[]) => {
                        onChange(values);
                      }}
                    />
                  </FormControl>

                  <FormDescription>
                    The events that will trigger a webhook to be sent to your URL.
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
                  <FormLabel>Secret</FormLabel>
                  <FormControl>
                    <PasswordInput className="bg-background" {...field} value={field.value ?? ''} />
                  </FormControl>

                  <FormDescription>
                    A secret that will be sent to your URL so you can verify that the request has
                    been sent by Documenso.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="mt-4">
              <Button type="submit" loading={form.formState.isSubmitting}>
                Update webhook
              </Button>
            </div>
          </fieldset>
        </form>
      </Form>
    </div>
  );
}
