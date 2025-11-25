import { useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import type * as DialogPrimitive from '@radix-ui/react-dialog';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';

import { trpc } from '@documenso/trpc/react';
import { ZCreateWebhookRequestSchema } from '@documenso/trpc/server/webhook-router/schema';
import { Button } from '@documenso/ui/primitives/button';
import {
  Dialog,
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

import { useCurrentTeam } from '~/providers/team';

import { WebhookMultiSelectCombobox } from '../general/webhook-multiselect-combobox';

const ZCreateWebhookFormSchema = ZCreateWebhookRequestSchema;

type TCreateWebhookFormSchema = z.infer<typeof ZCreateWebhookFormSchema>;

export type WebhookCreateDialogProps = {
  trigger?: React.ReactNode;
} & Omit<DialogPrimitive.DialogProps, 'children'>;

export const WebhookCreateDialog = ({ trigger, ...props }: WebhookCreateDialogProps) => {
  const { _ } = useLingui();
  const { toast } = useToast();

  const team = useCurrentTeam();

  const [open, setOpen] = useState(false);

  const form = useForm<TCreateWebhookFormSchema>({
    resolver: zodResolver(ZCreateWebhookFormSchema),
    values: {
      webhookUrl: '',
      eventTriggers: [],
      secret: '',
      enabled: true,
    },
  });

  const { mutateAsync: createWebhook } = trpc.webhook.createWebhook.useMutation();

  const onSubmit = async ({
    enabled,
    eventTriggers,
    secret,
    webhookUrl,
  }: TCreateWebhookFormSchema) => {
    try {
      await createWebhook({
        enabled,
        eventTriggers,
        secret,
        webhookUrl,
      });

      setOpen(false);

      toast({
        title: _(msg`Webhook created`),
        description: _(msg`The webhook was successfully created.`),
      });

      form.reset();
    } catch (err) {
      toast({
        title: _(msg`Error`),
        description: _(msg`An error occurred while creating the webhook. Please try again.`),
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
        {trigger ?? (
          <Button className="flex-shrink-0">
            <Trans>Create Webhook</Trans>
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-w-lg" position="center">
        <DialogHeader>
          <DialogTitle>
            <Trans>Create webhook</Trans>
          </DialogTitle>
          <DialogDescription>
            <Trans>On this page, you can create a new webhook.</Trans>
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <fieldset
              className="flex h-full flex-col space-y-4"
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
                    <FormLabel>
                      <Trans>Secret</Trans>
                    </FormLabel>
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
                        has been sent by Documenso
                      </Trans>
                      .
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                  <Trans>Cancel</Trans>
                </Button>

                <Button type="submit" loading={form.formState.isSubmitting}>
                  <Trans>Create</Trans>
                </Button>
              </DialogFooter>
            </fieldset>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
