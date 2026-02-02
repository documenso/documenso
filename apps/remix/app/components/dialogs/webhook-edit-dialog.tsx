import { useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useLingui } from '@lingui/react/macro';
import { Trans } from '@lingui/react/macro';
import type { Webhook } from '@prisma/client';
import type * as DialogPrimitive from '@radix-ui/react-dialog';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';

import { trpc } from '@documenso/trpc/react';
import { ZEditWebhookRequestSchema } from '@documenso/trpc/server/webhook-router/schema';
import { Button } from '@documenso/ui/primitives/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@documenso/ui/primitives/dialog';
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

import { WebhookMultiSelectCombobox } from '../general/webhook-multiselect-combobox';

const ZEditWebhookFormSchema = ZEditWebhookRequestSchema.omit({ id: true });

type TEditWebhookFormSchema = z.infer<typeof ZEditWebhookFormSchema>;

export type WebhookEditDialogProps = {
  trigger?: React.ReactNode;
  webhook: Webhook;
} & Omit<DialogPrimitive.DialogProps, 'children'>;

export const WebhookEditDialog = ({ trigger, webhook, ...props }: WebhookEditDialogProps) => {
  const { t } = useLingui();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);

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
        id: webhook.id,
        ...data,
      });

      toast({
        title: t`Webhook updated`,
        description: t`The webhook has been updated successfully.`,
        duration: 5000,
      });
    } catch (err) {
      toast({
        title: t`Failed to update webhook`,
        description: t`We encountered an error while updating the webhook. Please try again later.`,
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => !form.formState.isSubmitting && setOpen(value)}
      {...props}
    >
      <DialogTrigger onClick={(e) => e.stopPropagation()} asChild>
        {trigger}
      </DialogTrigger>

      <DialogContent className="max-w-lg" position="center">
        <DialogHeader>
          <DialogTitle>
            <Trans>Edit webhook</Trans>
          </DialogTitle>
          <DialogDescription>{webhook.id}</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <fieldset
              className="flex h-full flex-col gap-y-6"
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
                      <Trans>The events that will trigger a webhook to be sent to your URL.</Trans>
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
                      <PasswordInput
                        className="bg-background"
                        {...field}
                        value={field.value ?? ''}
                      />
                    </FormControl>

                    <FormDescription>
                      <Trans>
                        A secret that will be sent to your URL so you can verify that the request
                        has been sent by Documenso.
                      </Trans>
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="secondary">
                    <Trans>Close</Trans>
                  </Button>
                </DialogClose>

                <Button type="submit" loading={form.formState.isSubmitting}>
                  <Trans>Update</Trans>
                </Button>
              </DialogFooter>
            </fieldset>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
