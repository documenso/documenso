import { useState } from 'react';

import { useLingui } from '@lingui/react/macro';
import { Trans } from '@lingui/react/macro';

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
  DialogTrigger,
} from '@documenso/ui/primitives/dialog';
import { useToast } from '@documenso/ui/primitives/use-toast';

export type EnvelopeItemDeleteDialogProps = {
  canItemBeDeleted: boolean;
  envelopeId: string;
  envelopeItemId: string;
  envelopeItemTitle: string;
  onDelete?: (envelopeItemId: string) => void;
  trigger?: React.ReactNode;
};

export const EnvelopeItemDeleteDialog = ({
  trigger,
  canItemBeDeleted,
  envelopeId,
  envelopeItemId,
  envelopeItemTitle,
  onDelete,
}: EnvelopeItemDeleteDialogProps) => {
  const [open, setOpen] = useState(false);

  const { t } = useLingui();
  const { toast } = useToast();

  const { mutateAsync: deleteEnvelopeItem, isPending: isDeleting } =
    trpc.envelope.item.delete.useMutation({
      onSuccess: () => {
        toast({
          title: t`Success`,
          description: t`You have successfully removed this envelope item.`,
          duration: 5000,
        });

        onDelete?.(envelopeItemId);

        setOpen(false);
      },
      onError: () => {
        toast({
          title: t`An unknown error occurred`,
          description: t`We encountered an unknown error while attempting to remove this envelope item. Please try again later.`,
          variant: 'destructive',
          duration: 10000,
        });
      },
    });

  return (
    <Dialog open={open} onOpenChange={(value) => !isDeleting && setOpen(value)}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>

      {canItemBeDeleted ? (
        <DialogContent position="center">
          <DialogHeader>
            <DialogTitle>
              <Trans>Are you sure?</Trans>
            </DialogTitle>

            <DialogDescription className="mt-4">
              <Trans>
                You are about to remove the following document and all associated fields
              </Trans>
            </DialogDescription>
          </DialogHeader>

          <Alert variant="neutral">
            <AlertDescription className="text-center font-semibold">
              {envelopeItemTitle}
            </AlertDescription>
          </Alert>

          <fieldset disabled={isDeleting}>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                <Trans>Cancel</Trans>
              </Button>

              <Button
                type="submit"
                variant="destructive"
                loading={isDeleting}
                onClick={async () =>
                  deleteEnvelopeItem({
                    envelopeId,
                    envelopeItemId,
                  })
                }
              >
                <Trans>Delete</Trans>
              </Button>
            </DialogFooter>
          </fieldset>
        </DialogContent>
      ) : (
        <DialogContent position="center">
          <DialogHeader>
            <DialogTitle>
              <Trans>This item cannot be deleted</Trans>
            </DialogTitle>

            <DialogDescription className="mt-4">
              <Trans>
                You cannot delete this item because the document has been sent to recipients
              </Trans>
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              <Trans>Close</Trans>
            </Button>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  );
};
