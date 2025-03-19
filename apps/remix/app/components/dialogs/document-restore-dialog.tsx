import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';

import { useLimits } from '@documenso/ee/server-only/limits/provider/client';
import { trpc as trpcReact } from '@documenso/trpc/react';
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
import { useToast } from '@documenso/ui/primitives/use-toast';

type DocumentRestoreDialogProps = {
  id: number;
  open: boolean;
  onOpenChange: (_open: boolean) => void;
  onRestore?: () => Promise<void> | void;
  documentTitle: string;
  teamId?: number;
  canManageDocument: boolean;
};

export const DocumentRestoreDialog = ({
  id,
  open,
  onOpenChange,
  onRestore,
  documentTitle,
  canManageDocument,
}: DocumentRestoreDialogProps) => {
  const { toast } = useToast();
  const { refreshLimits } = useLimits();
  const { _ } = useLingui();

  const { mutateAsync: restoreDocument, isPending } =
    trpcReact.document.restoreDocument.useMutation({
      onSuccess: async () => {
        void refreshLimits();

        toast({
          title: _(msg`Document restored`),
          description: _(msg`"${documentTitle}" has been successfully restored`),
          duration: 5000,
        });

        await onRestore?.();

        onOpenChange(false);
      },
      onError: () => {
        toast({
          title: _(msg`Something went wrong`),
          description: _(msg`This document could not be restored at this time. Please try again.`),
          variant: 'destructive',
          duration: 7500,
        });
      },
    });

  return (
    <Dialog open={open} onOpenChange={(value) => !isPending && onOpenChange(value)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            <Trans>Restore Document</Trans>
          </DialogTitle>

          <DialogDescription>
            {canManageDocument ? (
              <Trans>
                You are about to restore <strong>"{documentTitle}"</strong>
              </Trans>
            ) : (
              <Trans>
                You are about to unhide <strong>"{documentTitle}"</strong>
              </Trans>
            )}
          </DialogDescription>
        </DialogHeader>

        <Alert variant="neutral" className="-mt-1">
          <AlertDescription>
            {canManageDocument ? (
              <Trans>
                The document will be restored to your account and will be available in your
                documents list.
              </Trans>
            ) : (
              <Trans>
                The document will be unhidden from your account and will be available in your
                documents list.
              </Trans>
            )}
          </AlertDescription>
        </Alert>

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            <Trans>Cancel</Trans>
          </Button>

          <Button
            type="button"
            loading={isPending}
            onClick={() => void restoreDocument({ documentId: id })}
          >
            <Trans>Restore</Trans>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
