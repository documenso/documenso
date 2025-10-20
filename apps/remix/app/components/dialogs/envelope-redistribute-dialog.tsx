import { useEffect, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react/macro';
import { Trans } from '@lingui/react/macro';
import { DocumentStatus, EnvelopeType, type Recipient, SigningStatus } from '@prisma/client';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

import { getRecipientType } from '@documenso/lib/client-only/recipient-type';
import type { TEnvelope } from '@documenso/lib/types/envelope';
import { recipientAbbreviation } from '@documenso/lib/utils/recipient-formatter';
import { trpc as trpcReact } from '@documenso/trpc/react';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import { Checkbox } from '@documenso/ui/primitives/checkbox';
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
  FormField,
  FormItem,
  FormLabel,
} from '@documenso/ui/primitives/form/form';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { StackAvatar } from '../general/stack-avatar';

export type EnvelopeRedistributeDialogProps = {
  envelope: Pick<TEnvelope, 'id' | 'userId' | 'teamId' | 'status' | 'type' | 'documentMeta'> & {
    recipients: Recipient[];
  };
  trigger?: React.ReactNode;
};

export const ZEnvelopeRedistributeFormSchema = z.object({
  recipients: z.array(z.number()).min(1, {
    message: msg`You must select at least one item`.id,
  }),
});

export type TEnvelopeRedistributeFormSchema = z.infer<typeof ZEnvelopeRedistributeFormSchema>;

export const EnvelopeRedistributeDialog = ({
  envelope,
  trigger,
}: EnvelopeRedistributeDialogProps) => {
  const recipients = envelope.recipients;

  const { toast } = useToast();
  const { t } = useLingui();

  const [isOpen, setIsOpen] = useState(false);

  const { mutateAsync: redistributeEnvelope } = trpcReact.envelope.redistribute.useMutation();

  const form = useForm<TEnvelopeRedistributeFormSchema>({
    defaultValues: {
      recipients: [],
    },
    resolver: zodResolver(ZEnvelopeRedistributeFormSchema),
  });

  const {
    handleSubmit,
    formState: { isSubmitting },
  } = form;

  const onFormSubmit = async ({ recipients }: TEnvelopeRedistributeFormSchema) => {
    try {
      await redistributeEnvelope({ envelopeId: envelope.id, recipients });

      toast({
        title: t`Envelope resent`,
        description: t`Your envelope has been resent successfully.`,
        duration: 5000,
      });

      setIsOpen(false);
    } catch (err) {
      toast({
        title: t`Something went wrong`,
        description: t`This envelope could not be resent at this time. Please try again.`,
        variant: 'destructive',
        duration: 7500,
      });
    }
  };

  useEffect(() => {
    if (!isOpen) {
      form.reset();
    }
  }, [isOpen]);

  if (envelope.status !== DocumentStatus.PENDING || envelope.type !== EnvelopeType.DOCUMENT) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>

      <DialogContent className="max-w-md" hideClose>
        <DialogHeader>
          <DialogTitle>
            <Trans>Resend Document</Trans>
          </DialogTitle>

          <DialogDescription>
            <Trans>Send reminders to the following recipients</Trans>
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={handleSubmit(onFormSubmit)}>
            <fieldset disabled={isSubmitting}>
              <FormField
                control={form.control}
                name="recipients"
                render={({ field: { value, onChange } }) => (
                  <>
                    {recipients
                      .filter((recipient) => recipient.signingStatus === SigningStatus.NOT_SIGNED)
                      .map((recipient) => (
                        <FormItem
                          key={recipient.id}
                          className="flex flex-row items-center justify-between gap-x-3 px-3"
                        >
                          <FormLabel
                            className={cn('my-2 flex items-center gap-2 font-normal', {
                              'opacity-50': !value.includes(recipient.id),
                            })}
                          >
                            <StackAvatar
                              key={recipient.id}
                              type={getRecipientType(recipient)}
                              fallbackText={recipientAbbreviation(recipient)}
                            />
                            {recipient.email}
                          </FormLabel>

                          <FormControl>
                            <Checkbox
                              className="h-5 w-5 rounded-full"
                              value={recipient.id}
                              checked={value.includes(recipient.id)}
                              onCheckedChange={(checked: boolean) =>
                                checked
                                  ? onChange([...value, recipient.id])
                                  : onChange(value.filter((v) => v !== recipient.id))
                              }
                            />
                          </FormControl>
                        </FormItem>
                      ))}
                  </>
                )}
              />

              <DialogFooter className="mt-4">
                <DialogClose asChild>
                  <Button type="button" variant="secondary" disabled={isSubmitting}>
                    <Trans>Cancel</Trans>
                  </Button>
                </DialogClose>

                <Button loading={isSubmitting} type="submit">
                  <Trans>Send reminder</Trans>
                </Button>
              </DialogFooter>
            </fieldset>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
