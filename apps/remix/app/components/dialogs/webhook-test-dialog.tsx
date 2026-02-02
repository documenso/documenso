import { useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { Trans, useLingui } from '@lingui/react/macro';
import type { Webhook } from '@prisma/client';
import { WebhookTriggerEvents } from '@prisma/client';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { toFriendlyWebhookEventName } from '@documenso/lib/universal/webhook/to-friendly-webhook-event-name';
import { trpc } from '@documenso/trpc/react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@documenso/ui/primitives/select';
import { useToast } from '@documenso/ui/primitives/use-toast';

export type WebhookTestDialogProps = {
  webhook: Pick<Webhook, 'id' | 'webhookUrl' | 'eventTriggers'>;
  children: React.ReactNode;
};

const ZTestWebhookFormSchema = z.object({
  event: z.nativeEnum(WebhookTriggerEvents),
});

type TTestWebhookFormSchema = z.infer<typeof ZTestWebhookFormSchema>;

export const WebhookTestDialog = ({ webhook, children }: WebhookTestDialogProps) => {
  const { t } = useLingui();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);

  const { mutateAsync: testWebhook } = trpc.webhook.testWebhook.useMutation();

  const form = useForm<TTestWebhookFormSchema>({
    resolver: zodResolver(ZTestWebhookFormSchema),
    defaultValues: {
      event: webhook.eventTriggers[0],
    },
  });

  const onSubmit = async ({ event }: TTestWebhookFormSchema) => {
    try {
      await testWebhook({
        id: webhook.id,
        event,
      });

      toast({
        title: t`Test webhook sent`,
        description: t`The test webhook has been successfully sent to your endpoint.`,
        duration: 5000,
      });

      setOpen(false);
    } catch (error) {
      toast({
        title: t`Test webhook failed`,
        description: t`We encountered an error while sending the test webhook. Please check your endpoint and try again.`,
        variant: 'destructive',
        duration: 5000,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !form.formState.isSubmitting && setOpen(value)}>
      <DialogTrigger asChild>{children}</DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            <Trans>Test Webhook</Trans>
          </DialogTitle>

          <DialogDescription>
            <Trans>
              Send a test webhook with sample data to verify your integration is working correctly.
            </Trans>
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <fieldset
              className="flex h-full flex-col space-y-4"
              disabled={form.formState.isSubmitting}
            >
              <FormField
                control={form.control}
                name="event"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      <Trans>Event Type</Trans>
                    </FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t`Select an event type`} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {webhook.eventTriggers.map((event) => (
                          <SelectItem key={event} value={event}>
                            {toFriendlyWebhookEventName(event)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="rounded-md border p-4">
                <h4 className="mb-2 text-sm font-medium">
                  <Trans>Webhook URL</Trans>
                </h4>
                <p className="text-muted-foreground break-all text-sm">{webhook.webhookUrl}</p>
              </div>

              <DialogFooter>
                <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                  <Trans>Close</Trans>
                </Button>

                <Button type="submit" loading={form.formState.isSubmitting}>
                  <Trans>Send</Trans>
                </Button>
              </DialogFooter>
            </fieldset>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
