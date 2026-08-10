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
import { Plural, Trans, useLingui } from '@lingui/react/macro';
import { useState } from 'react';

export type EmailTransportDeleteDialogProps = {
  transportId: string;
  transportName: string;
  subscriptionClaimCount: number;
  organisationClaimCount: number;
  trigger: React.ReactNode;
};

export const EmailTransportDeleteDialog = ({
  transportId,
  transportName,
  subscriptionClaimCount,
  organisationClaimCount,
  trigger,
}: EmailTransportDeleteDialogProps) => {
  const { t } = useLingui();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);

  const isInUse = subscriptionClaimCount + organisationClaimCount > 0;

  const { mutateAsync: deleteTransport, isPending } = trpc.admin.emailTransport.delete.useMutation({
    onSuccess: () => {
      toast({
        title: t`Transport deleted.`,
      });

      setOpen(false);
    },
    onError: () => {
      toast({
        title: t`Failed to delete transport.`,
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
            <Trans>Delete Email Transport</Trans>
          </DialogTitle>
          <DialogDescription>
            <Trans>Are you sure you want to delete the following transport?</Trans>
          </DialogDescription>
        </DialogHeader>

        <Alert variant="neutral">
          <AlertDescription className="text-center font-semibold">{transportName}</AlertDescription>
        </Alert>

        {isInUse && (
          <Alert variant="destructive">
            <AlertDescription>
              <Trans>Warning, this email transport is currently being used by:</Trans>

              <ul className="mt-2 list-disc pl-5">
                {subscriptionClaimCount > 0 && (
                  <li>
                    <Plural value={subscriptionClaimCount} one="# Subscription claim" other="# Subscription claims" />
                  </li>
                )}

                {organisationClaimCount > 0 && (
                  <li>
                    <Plural value={organisationClaimCount} one="# Organisation claim" other="# Organisation claims" />
                  </li>
                )}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => setOpen(false)} disabled={isPending}>
            <Trans>Cancel</Trans>
          </Button>

          <Button
            type="submit"
            variant="destructive"
            loading={isPending}
            onClick={async () => deleteTransport({ id: transportId })}
          >
            <Trans>Delete</Trans>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
