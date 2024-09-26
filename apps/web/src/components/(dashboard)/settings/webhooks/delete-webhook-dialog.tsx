'use effect';

import { useEffect, useState } from 'react';

import { useRouter } from 'next/navigation';

import { zodResolver } from '@hookform/resolvers/zod';
import { Trans, msg } from '@lingui/macro';
import { useLingui } from '@lingui/react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import type { Webhook } from '@documenso/prisma/client';
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
import { Input } from '@documenso/ui/primitives/input';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { useOptionalCurrentTeam } from '~/providers/team';

export type DeleteWebhookDialogProps = {
  webhook: Pick<Webhook, 'id' | 'webhookUrl'>;
  onDelete?: () => void;
  children: React.ReactNode;
};

export const DeleteWebhookDialog = ({ webhook, children }: DeleteWebhookDialogProps) => {
  const { _ } = useLingui();
  const { toast } = useToast();

  const router = useRouter();

  const team = useOptionalCurrentTeam();

  const [open, setOpen] = useState(false);

  const deleteMessage = `delete ${webhook.webhookUrl}`;

  const ZDeleteWebhookFormSchema = z.object({
    webhookUrl: z.literal(deleteMessage, {
      errorMap: () => ({ message: _(msg`You must enter '${deleteMessage}' to proceed`) }),
    }),
  });

  type TDeleteWebhookFormSchema = z.infer<typeof ZDeleteWebhookFormSchema>;

  const { mutateAsync: deleteWebhook } = trpc.webhook.deleteWebhook.useMutation();

  const form = useForm<TDeleteWebhookFormSchema>({
    resolver: zodResolver(ZDeleteWebhookFormSchema),
    values: {
      webhookUrl: '',
    },
  });

  const onSubmit = async () => {
    try {
      await deleteWebhook({ id: webhook.id, teamId: team?.id });

      toast({
        title: _(msg`Webhook deleted`),
        description: _(msg`The webhook has been successfully deleted.`),
        duration: 5000,
      });

      setOpen(false);

      router.refresh();
    } catch (error) {
      toast({
        title: _(msg`An unknown error occurred`),
        description: _(
          msg`We encountered an unknown error while attempting to delete it. Please try again later.`,
        ),
        variant: 'destructive',
        duration: 5000,
      });
    }
  };

  useEffect(() => {
    if (!open) {
      form.reset();
    }
  }, [open, form]);

  return (
    <Dialog open={open} onOpenChange={(value) => !form.formState.isSubmitting && setOpen(value)}>
      <DialogTrigger asChild>
        {children ?? (
          <Button className="mr-4" variant="destructive">
            <Trans>Delete</Trans>
          </Button>
        )}
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            <Trans>Delete Webhook</Trans>
          </DialogTitle>

          <DialogDescription>
            <Trans>
              Please note that this action is irreversible. Once confirmed, your webhook will be
              permanently deleted.
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
                name="webhookUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      <Trans>
                        Confirm by typing:{' '}
                        <span className="font-sm text-destructive font-semibold">
                          {deleteMessage}
                        </span>
                      </Trans>
                    </FormLabel>
                    <FormControl>
                      <Input className="bg-background" type="text" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <div className="flex w-full flex-nowrap gap-4">
                  <Button
                    type="button"
                    variant="secondary"
                    className="flex-1"
                    onClick={() => setOpen(false)}
                  >
                    <Trans>Cancel</Trans>
                  </Button>

                  <Button
                    type="submit"
                    variant="destructive"
                    className="flex-1"
                    disabled={!form.formState.isValid}
                    loading={form.formState.isSubmitting}
                  >
                    <Trans>I'm sure! Delete it</Trans>
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
