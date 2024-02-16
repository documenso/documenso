'use client';

import { useState } from 'react';

import { useRouter } from 'next/navigation';

import { zodResolver } from '@hookform/resolvers/zod';
import type * as DialogPrimitive from '@radix-ui/react-dialog';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';

import { trpc } from '@documenso/trpc/react';
import { ZCreateWebhookFormSchema } from '@documenso/trpc/server/webhook-router/schema';
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@documenso/ui/primitives/form/form';
import { Input } from '@documenso/ui/primitives/input';
import { PasswordInput } from '@documenso/ui/primitives/password-input';
import { Switch } from '@documenso/ui/primitives/switch';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { MultiSelectCombobox } from './multiselect-combobox';

type TCreateWebhookFormSchema = z.infer<typeof ZCreateWebhookFormSchema>;

export type CreateWebhookDialogProps = {
  trigger?: React.ReactNode;
} & Omit<DialogPrimitive.DialogProps, 'children'>;

export const CreateWebhookDialog = ({ trigger, ...props }: CreateWebhookDialogProps) => {
  const router = useRouter();
  const { toast } = useToast();
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

  const onSubmit = async (values: TCreateWebhookFormSchema) => {
    try {
      await createWebhook(values);

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

      <DialogContent>
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
              <FormField
                control={form.control}
                name="webhookUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>Webhook URL</FormLabel>
                    <FormControl>
                      <Input className="bg-background" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="eventTriggers"
                render={({ field: { onChange, value } }) => (
                  <FormItem className="flex flex-col gap-2">
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
                      <PasswordInput
                        className="bg-background"
                        {...field}
                        value={field.value ?? ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="enabled"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2">
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
