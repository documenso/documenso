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
import { Trans, useLingui } from '@lingui/react/macro';
import { useState } from 'react';

export type EmailSuppressionDeleteDialogProps = {
  suppressionId: string;
  email: string;
};

export const EmailSuppressionDeleteDialog = ({ suppressionId, email }: EmailSuppressionDeleteDialogProps) => {
  const { t } = useLingui();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);

  const { mutateAsync: deleteSuppression, isPending } = trpc.admin.emailSuppression.delete.useMutation({
    onSuccess: () => {
      toast({
        title: t`Suppression removed.`,
      });

      setOpen(false);
    },
    onError: () => {
      toast({
        title: t`Failed to remove suppression.`,
        variant: 'destructive',
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={(value) => !isPending && setOpen(value)}>
      <DialogTrigger asChild onClick={(e) => e.stopPropagation()}>
        <Button variant="ghost" size="sm">
          <Trans>Remove</Trans>
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            <Trans>Remove Email Suppression</Trans>
          </DialogTitle>
          <DialogDescription>
            <Trans>Emails blocked by this suppression will be sent to this address again.</Trans>
          </DialogDescription>
        </DialogHeader>

        <Alert variant="neutral">
          <AlertDescription className="text-center font-semibold">{email}</AlertDescription>
        </Alert>

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => setOpen(false)} disabled={isPending}>
            <Trans>Cancel</Trans>
          </Button>

          <Button
            type="submit"
            variant="destructive"
            loading={isPending}
            onClick={async () => deleteSuppression({ id: suppressionId })}
          >
            <Trans>Remove</Trans>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
