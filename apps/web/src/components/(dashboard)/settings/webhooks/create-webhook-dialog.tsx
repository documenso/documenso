'use client';

import { useState } from 'react';

import { useRouter } from 'next/navigation';

import { zodResolver } from '@hookform/resolvers/zod';
import type * as DialogPrimitive from '@radix-ui/react-dialog';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';

import { trpc } from '@documenso/trpc/react';
import { ZCreateWebhookMutationSchema } from '@documenso/trpc/server/webhook-router/schema';
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

import { useOptionalCurrentTeam } from '~/providers/team';

import { TriggerMultiSelectCombobox } from './trigger-multiselect-combobox';

const ZCreateWebhookFormSchema = ZCreateWebhookMutationSchema.omit({ teamId: true });

type TCreateWebhookFormSchema = z.infer<typeof ZCreateWebhookFormSchema>;

export type CreateWebhookDialogProps = {
  trigger?: React.ReactNode;
} & Omit<DialogPrimitive.DialogProps, 'children'>;

export const CreateWebhookDialog = ({ trigger, ...props }: CreateWebhookDialogProps) => {
  const router = useRouter();
  const { toast } = useToast();

  const team = useOptionalCurrentTeam();

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
        teamId: team?.id,
      });

      setOpen(false);

      toast({
        title: 'Webhook created',
        description: 'The webhook was successfully created.',
      });

      form.reset();

      router.refresh();
    } catch (err) {
      toast({
        title: 'Error',
        description: 'An error occurred while creating the webhook. Please try again.',
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
        {trigger ?? <Button className="flex-shrink-0">Create Webhook</Button>}
      </DialogTrigger>

      <DialogContent className="max-w-lg" position="center">
        <DialogHeader>
          <DialogTitle>Create webhook</DialogTitle>
          <DialogDescription>On this page, you can create a new webhook.</DialogDescription>
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
                      <PasswordInput
                        className="bg-background"
                        {...field}
                        value={field.value ?? ''}
                      />
                    </FormControl>

                    <FormDescription>
                      A secret that will be sent to your URL so you can verify that the request has
                      been sent by Documenso.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <div className="flex w-full flex-nowrap gap-4">
                  <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" loading={form.formState.isSubmitting}>
                    Create
                  </Button>
                </div>
              </DialogFooter>
            </fieldset>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
