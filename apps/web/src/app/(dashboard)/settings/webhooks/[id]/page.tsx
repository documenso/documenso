'use client';

import { useRouter } from 'next/navigation';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';

import { trpc } from '@documenso/trpc/react';
import { ZEditWebhookMutationSchema } from '@documenso/trpc/server/webhook-router/schema';
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
import { PasswordInput } from '@documenso/ui/primitives/password-input';
import { Switch } from '@documenso/ui/primitives/switch';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { SettingsHeader } from '~/components/(dashboard)/settings/layout/header';
import { MultiSelectCombobox } from '~/components/(dashboard)/settings/webhooks/multiselect-combobox';

const ZEditWebhookFormSchema = ZEditWebhookMutationSchema.omit({ id: true });

type TEditWebhookFormSchema = z.infer<typeof ZEditWebhookFormSchema>;

export type WebhookPageOptions = {
  params: {
    id: number;
  };
};

export default function WebhookPage({ params }: WebhookPageOptions) {
  const { toast } = useToast();
  const router = useRouter();

  const { data: webhook } = trpc.webhook.getWebhookById.useQuery(
    {
      id: Number(params.id),
    },
    { enabled: !!params.id },
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
        id: Number(params.id),
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
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <fieldset className="flex h-full flex-col gap-y-6" disabled={form.formState.isSubmitting}>
            <FormField
              control={form.control}
              name="webhookUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="webhookUrl">Webhook URL</FormLabel>
                  <Input {...field} id="webhookUrl" type="text" />
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="eventTriggers"
              render={({ field: { onChange, value } }) => (
                <FormItem className="flex flex-col">
                  <FormLabel required>Event triggers</FormLabel>
                  <FormControl>
                    <MultiSelectCombobox
                      listValues={value}
                      onChange={(values: string[]) => {
                        onChange(values);
                      }}
                    />
                  </FormControl>
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
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="enabled"
              render={({ field }) => (
                <FormItem className="flex items-center gap-x-2">
                  <FormLabel className="mt-2">Active</FormLabel>
                  <FormControl>
                    <Switch
                      className="bg-background"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
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
