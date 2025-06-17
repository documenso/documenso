import { useState } from 'react';

import { Trans, useLingui } from '@lingui/react/macro';

import { authClient } from '@documenso/auth/client';
import { Button } from '@documenso/ui/primitives/button';
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
import { useToast } from '@documenso/ui/primitives/use-toast';

type SessionLogoutAllDialogProps = {
  onSuccess?: () => Promise<unknown>;
  disabled?: boolean;
};

export const SessionLogoutAllDialog = ({ onSuccess, disabled }: SessionLogoutAllDialogProps) => {
  const { t } = useLingui();
  const { toast } = useToast();

  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSignOutAllSessions = async () => {
    setIsLoading(true);

    try {
      await authClient.signOutAllSessions();

      if (onSuccess) {
        await onSuccess();
      }

      toast({
        title: t`Sessions have been revoked`,
      });

      setIsOpen(false);
    } catch (error) {
      console.error(error);

      toast({
        title: t`Error`,
        description: t`Failed to sign out all sessions`,
        variant: 'destructive',
      });
    }

    setIsLoading(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(value) => (isLoading ? undefined : setIsOpen(value))}>
      <DialogTrigger asChild>
        <Button variant="secondary" disabled={disabled}>
          <Trans>Revoke all sessions</Trans>
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            <Trans>Revoke all sessions</Trans>
          </DialogTitle>
          <DialogDescription>
            <Trans>
              This will sign you out of all other devices. You will need to sign in again on those
              devices to continue using your account.
            </Trans>
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="secondary" disabled={isLoading}>
              <Trans>Cancel</Trans>
            </Button>
          </DialogClose>

          <Button loading={isLoading} variant="destructive" onClick={handleSignOutAllSessions}>
            <Trans>Revoke all sessions</Trans>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
