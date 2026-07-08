import { plural } from '@lingui/core/macro';
import { Plural, useLingui } from '@lingui/react/macro';
import { Trans } from '@lingui/react/macro';
import type * as DialogPrimitive from '@radix-ui/react-dialog';

import { trpc } from '@documenso/trpc/react';
import { Button } from '@documenso/ui/primitives/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@documenso/ui/primitives/dialog';
import { useToast } from '@documenso/ui/primitives/use-toast';

export type EnvelopesBulkResendDialogProps = {
  envelopeIds: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
} & Omit<DialogPrimitive.DialogProps, 'children'>;

export const EnvelopesBulkResendDialog = ({
  envelopeIds,
  open,
  onOpenChange,
  onSuccess,
  ...props
}: EnvelopesBulkResendDialogProps) => {
  const { t } = useLingui();
  const { toast } = useToast();

  const trpcUtils = trpc.useUtils();

  const { mutateAsync: bulkResendEnvelopes, isPending } =
    trpc.envelope.bulk.redistribute.useMutation({
      onSuccess: async (result) => {
        await trpcUtils.document.findDocumentsInternal.invalidate();

        if (result.resentCount === 0) {
          toast({
            title: t`No reminders sent`,
            description: t`None of the selected documents had pending recipients to remind.`,
            variant: 'default',
          });
        } else if (result.failedIds.length > 0) {
          toast({
            title: t`Reminders partially sent`,
            description: t`${plural(result.resentCount, {
              one: 'Reminders sent for # document.',
              other: 'Reminders sent for # documents.',
            })} ${plural(result.failedIds.length, {
              one: '# document could not be resent.',
              other: '# documents could not be resent.',
            })}`,
            variant: 'destructive',
          });
        } else {
          toast({
            title: t`Reminders sent`,
            description: plural(result.resentCount, {
              one: 'Reminders sent for # document.',
              other: 'Reminders sent for # documents.',
            }),
            variant: 'default',
          });
        }

        onSuccess?.();
        onOpenChange(false);
      },
      onError: () => {
        toast({
          title: t`Error`,
          description: t`An error occurred while resending the documents.`,
          variant: 'destructive',
        });
      },
    });

  return (
    <Dialog {...props} open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            <Trans>Resend Documents</Trans>
          </DialogTitle>

          <DialogDescription>
            <Plural
              value={envelopeIds.length}
              one="You are about to resend the selected document."
              other="You are about to resend # documents."
            />
          </DialogDescription>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          <Trans>
            Signing reminders will be sent to every recipient of the selected documents who has not
            yet signed. Draft and completed documents are skipped.
          </Trans>
        </p>

        <DialogFooter>
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            <Trans>Cancel</Trans>
          </Button>

          <Button
            onClick={(e) => {
              e.preventDefault();
              void bulkResendEnvelopes({ envelopeIds });
            }}
            loading={isPending}
          >
            <Trans>Resend</Trans>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
