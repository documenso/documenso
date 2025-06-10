import { useState } from 'react';

import { Trans, useLingui } from '@lingui/react/macro';

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

export type ClaimDeleteDialogProps = {
  claimId: string;
  claimName: string;
  claimLocked: boolean;
  trigger: React.ReactNode;
};

export const ClaimDeleteDialog = ({
  claimId,
  claimName,
  claimLocked,
  trigger,
}: ClaimDeleteDialogProps) => {
  const { t } = useLingui();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);

  const { mutateAsync: deleteClaim, isPending } = trpc.admin.claims.delete.useMutation({
    onSuccess: () => {
      toast({
        title: t`Subscription claim deleted successfully.`,
      });

      setOpen(false);
    },
    onError: (err) => {
      console.error(err);

      toast({
        title: t`Failed to delete subscription claim.`,
        variant: 'destructive',
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={(value) => !isPending && setOpen(value)}>
      <DialogTrigger asChild onClick={(e) => e.stopPropagation()}>
        {trigger}
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            <Trans>Delete Subscription Claim</Trans>
          </DialogTitle>
          <DialogDescription>
            <Trans>Are you sure you want to delete the following claim?</Trans>
          </DialogDescription>
        </DialogHeader>

        <Alert variant="neutral">
          <AlertDescription className="text-center font-semibold">
            {claimLocked ? <Trans>This claim is locked and cannot be deleted.</Trans> : claimName}
          </AlertDescription>
        </Alert>

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
            <Trans>Cancel</Trans>
          </Button>

          {!claimLocked && (
            <Button
              type="submit"
              variant="destructive"
              loading={isPending}
              onClick={async () => deleteClaim({ id: claimId })}
            >
              <Trans>Delete</Trans>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
