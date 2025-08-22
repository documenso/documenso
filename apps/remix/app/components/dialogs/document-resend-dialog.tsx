import { useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { type Recipient, SigningStatus } from '@prisma/client';
import { History } from 'lucide-react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

import { useSession } from '@documenso/lib/client-only/providers/session';
import { getRecipientType } from '@documenso/lib/client-only/recipient-type';
import type { TDocumentMany as TDocumentRow } from '@documenso/lib/types/document';
import { recipientAbbreviation } from '@documenso/lib/utils/recipient-formatter';
import { trpc as trpcReact } from '@documenso/trpc/react';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import { Checkbox } from '@documenso/ui/primitives/checkbox';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@documenso/ui/primitives/dialog';
import { DropdownMenuItem } from '@documenso/ui/primitives/dropdown-menu';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from '@documenso/ui/primitives/form/form';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { useCurrentTeam } from '~/providers/team';

import { StackAvatar } from '../general/stack-avatar';

const FORM_ID = 'resend-email';

export type DocumentResendDialogProps = {
  document: TDocumentRow;
  recipients: Recipient[];
};

export const ZResendDocumentFormSchema = z.object({
  recipients: z.array(z.number()).min(1, {
    message: 'You must select at least one item.',
  }),
});

export type TResendDocumentFormSchema = z.infer<typeof ZResendDocumentFormSchema>;

export const DocumentResendDialog = ({ document, recipients }: DocumentResendDialogProps) => {
  const { user } = useSession();
  const team = useCurrentTeam();

  const { toast } = useToast();
  const { _ } = useLingui();

  const [isOpen, setIsOpen] = useState(false);
  const isOwner = document.userId === user.id;
  const isCurrentTeamDocument = team && document.team?.url === team.url;

  const isDisabled =
    (!isOwner && !isCurrentTeamDocument) ||
    document.status !== 'PENDING' ||
    !recipients.some((r) => r.signingStatus === SigningStatus.NOT_SIGNED);

  const { mutateAsync: resendDocument } = trpcReact.document.resendDocument.useMutation();

  const form = useForm<TResendDocumentFormSchema>({
    resolver: zodResolver(ZResendDocumentFormSchema),
    defaultValues: {
      recipients: [],
    },
  });

  const {
    handleSubmit,
    formState: { isSubmitting },
  } = form;

  const onFormSubmit = async ({ recipients }: TResendDocumentFormSchema) => {
    try {
      await resendDocument({ documentId: document.id, recipients });

      toast({
        title: _(msg`Document re-sent`),
        description: _(msg`Your document has been re-sent successfully.`),
        duration: 5000,
      });

      setIsOpen(false);
    } catch (err) {
      toast({
        title: _(msg`Something went wrong`),
        description: _(msg`This document could not be re-sent at this time. Please try again.`),
        variant: 'destructive',
        duration: 7500,
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <DropdownMenuItem disabled={isDisabled} onSelect={(e) => e.preventDefault()}>
          <History className="mr-2 h-4 w-4" />
          <Trans>Resend</Trans>
        </DropdownMenuItem>
      </DialogTrigger>

      <DialogContent className="sm:max-w-sm" hideClose>
        <DialogHeader>
          <DialogTitle asChild>
            <h1 className="text-center text-xl">
              <Trans>Who do you want to remind?</Trans>
            </h1>
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form id={FORM_ID} onSubmit={handleSubmit(onFormSubmit)} className="px-3">
            <FormField
              control={form.control}
              name="recipients"
              render={({ field: { value, onChange } }) => (
                <>
                  {recipients.map((recipient) => (
                    <FormItem
                      key={recipient.id}
                      className="flex flex-row items-center justify-between gap-x-3"
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
          </form>
        </Form>

        <DialogFooter>
          <div className="flex w-full flex-1 flex-nowrap gap-4">
            <DialogClose asChild>
              <Button
                type="button"
                className="dark:bg-muted dark:hover:bg-muted/80 flex-1 bg-black/5 hover:bg-black/10"
                variant="secondary"
                disabled={isSubmitting}
              >
                <Trans>Cancel</Trans>
              </Button>
            </DialogClose>

            <Button className="flex-1" loading={isSubmitting} type="submit" form={FORM_ID}>
              <Trans>Send reminder</Trans>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
