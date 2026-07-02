import { trpc } from '@documenso/trpc/react';
import { Alert, AlertDescription } from '@documenso/ui/primitives/alert';
import { Button } from '@documenso/ui/primitives/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@documenso/ui/primitives/dialog';
import { Label } from '@documenso/ui/primitives/label';
import { Textarea } from '@documenso/ui/primitives/textarea';
import { useToast } from '@documenso/ui/primitives/use-toast';
import { plural } from '@lingui/core/macro';
import { Plural, Trans, useLingui } from '@lingui/react/macro';
import type * as DialogPrimitive from '@radix-ui/react-dialog';
import { useEffect, useState } from 'react';

export type EnvelopesBulkCancelDialogProps = {
  envelopeIds: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
} & Omit<DialogPrimitive.DialogProps, 'children'>;

export const EnvelopesBulkCancelDialog = ({
  envelopeIds,
  open,
  onOpenChange,
  onSuccess,
  ...props
}: EnvelopesBulkCancelDialogProps) => {
  const { t } = useLingui();
  const { toast } = useToast();

  const trpcUtils = trpc.useUtils();

  const [reason, setReason] = useState('');

  useEffect(() => {
    if (open) {
      setReason('');
    }
  }, [open]);

  const { mutateAsync: bulkCancelEnvelopes, isPending } = trpc.envelope.bulk.cancel.useMutation({
    onSuccess: async (result) => {
      await trpcUtils.document.findDocumentsInternal.invalidate();

      if (result.failedIds.length > 0) {
        toast({
          title: t`Documents partially cancelled`,
          description: t`${plural(result.cancelledCount, {
            one: '# document cancelled.',
            other: '# documents cancelled.',
          })} ${plural(result.failedIds.length, {
            one: '# document could not be cancelled.',
            other: '# documents could not be cancelled.',
          })}`,
          variant: 'destructive',
        });
      } else {
        toast({
          title: t`Documents cancelled`,
          description: plural(result.cancelledCount, {
            one: '# document has been cancelled.',
            other: '# documents have been cancelled.',
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
        description: t`An error occurred while cancelling the documents.`,
        variant: 'destructive',
      });
    },
  });

  return (
    <Dialog {...props} open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            <Trans>Cancel Documents</Trans>
          </DialogTitle>

          <DialogDescription>
            <Plural
              value={envelopeIds.length}
              one="You are about to cancel the selected document."
              other="You are about to cancel # documents."
            />
          </DialogDescription>
        </DialogHeader>

        <Alert variant="warning">
          <AlertDescription>
            <p>
              <Trans>Only pending documents you have permission to manage will be cancelled.</Trans>
            </p>

            <p className="mt-1">
              <Trans>Once confirmed, the following will occur:</Trans>
            </p>

            <ul className="mt-0.5 list-inside list-disc">
              <li>
                <Trans>The document signing process will be stopped</Trans>
              </li>
              <li>
                <Trans>Recipients will be notified that the document was cancelled</Trans>
              </li>
              <li>
                <Trans>The documents will remain in your dashboard marked as Cancelled</Trans>
              </li>
            </ul>
          </AlertDescription>
        </Alert>

        <div className="flex flex-col gap-2">
          <Label htmlFor="bulk-cancel-reason">
            <Trans>Reason (optional)</Trans>
          </Label>

          <Textarea
            id="bulk-cancel-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={t`Add an optional reason for cancelling these documents`}
          />
        </div>

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={isPending}>
            <Trans>Cancel</Trans>
          </Button>

          <Button
            onClick={(e) => {
              e.preventDefault();
              void bulkCancelEnvelopes({ envelopeIds, reason: reason || undefined });
            }}
            loading={isPending}
            variant="destructive"
          >
            <Trans>Cancel documents</Trans>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
