import { AppError } from '@documenso/lib/errors/app-error';
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@documenso/ui/primitives/form/form';
import { Textarea } from '@documenso/ui/primitives/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@documenso/ui/primitives/tooltip';
import { useToast } from '@documenso/ui/primitives/use-toast';
import { zodResolver } from '@hookform/resolvers/zod';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useRevalidator } from 'react-router';
import { z } from 'zod';

const ZAdminRecipientDeleteFormSchema = z.object({
  reason: z.string().trim().min(1, { message: 'A reason is required' }).max(500),
});

type TAdminRecipientDeleteFormSchema = z.infer<typeof ZAdminRecipientDeleteFormSchema>;

export type AdminRecipientDeleteDialogProps = {
  recipientId: number;
  recipientName: string;
  recipientEmail: string;
  /**
   * When set the trigger is disabled and this is shown as the tooltip.
   */
  disabledReason?: string;
};

export const AdminRecipientDeleteDialog = ({
  recipientId,
  recipientName,
  recipientEmail,
  disabledReason,
}: AdminRecipientDeleteDialogProps) => {
  const { _ } = useLingui();
  const { toast } = useToast();
  const { revalidate } = useRevalidator();

  const [isOpen, setIsOpen] = useState(false);

  const form = useForm<TAdminRecipientDeleteFormSchema>({
    resolver: zodResolver(ZAdminRecipientDeleteFormSchema),
    defaultValues: {
      reason: '',
    },
  });

  const { mutateAsync: deleteRecipient } = trpc.admin.recipient.delete.useMutation();

  const recipientLabel =
    recipientName && recipientName !== recipientEmail ? `${recipientName} (${recipientEmail})` : recipientEmail;

  const onOpenChange = (open: boolean) => {
    if (form.formState.isSubmitting) {
      return;
    }

    form.reset();
    setIsOpen(open);
  };

  const onFormSubmit = async ({ reason }: TAdminRecipientDeleteFormSchema) => {
    try {
      await deleteRecipient({ id: recipientId, reason });

      toast({
        title: _(msg`Recipient removed`),
        description: _(msg`The recipient has been removed and the document owner has been notified.`),
        duration: 5000,
      });

      setIsOpen(false);

      await revalidate();
    } catch (err) {
      const error = AppError.parseError(err);

      toast({
        title: _(msg`Failed to remove recipient`),
        description: error.message || _(msg`We encountered an unknown error while removing the recipient.`),
        variant: 'destructive',
      });
    }
  };

  if (disabledReason) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button type="button" variant="ghost" className="pointer-events-none text-destructive" disabled>
                <Trans>Remove Recipient</Trans>
              </Button>
            </span>
          </TooltipTrigger>

          <TooltipContent className="max-w-[40ch]">{disabledReason}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" className="text-destructive hover:text-destructive">
          <Trans>Remove Recipient</Trans>
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            <Trans>Remove Recipient</Trans>
          </DialogTitle>

          <DialogDescription>
            <Trans>
              <span className="font-medium text-foreground">{recipientLabel}</span> and their fields will be removed
              from this document. They and the document owner will be emailed.
            </Trans>
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={(event) => {
              // The trigger may live inside another form, React bubbles submit events through portals.
              event.stopPropagation();

              void form.handleSubmit(onFormSubmit)(event);
            }}
          >
            <fieldset className="flex flex-col gap-y-4" disabled={form.formState.isSubmitting}>
              <FormField
                control={form.control}
                name="reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>
                      <Trans>Reason</Trans>
                    </FormLabel>

                    <FormControl>
                      <Textarea {...field} rows={3} placeholder={_(msg`e.g. Removed at the sender's request`)} />
                    </FormControl>

                    <FormDescription>
                      <Trans>Visible to the document owner in the audit log.</Trans>
                    </FormDescription>

                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
                  <Trans>Cancel</Trans>
                </Button>

                <Button type="submit" variant="destructive" loading={form.formState.isSubmitting}>
                  <Trans>Remove</Trans>
                </Button>
              </DialogFooter>
            </fieldset>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
