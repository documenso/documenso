import { useState } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';

import { authClient } from '@documenso/auth/client';
import { useSession } from '@documenso/lib/client-only/providers/session';
import { trpc } from '@documenso/trpc/react';
import { Alert, AlertDescription, AlertTitle } from '@documenso/ui/primitives/alert';
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
import { Input } from '@documenso/ui/primitives/input';
import { Label } from '@documenso/ui/primitives/label';
import { useToast } from '@documenso/ui/primitives/use-toast';

export type AccountDeleteDialogProps = {
  className?: string;
};

export const AccountDeleteDialog = ({ className }: AccountDeleteDialogProps) => {
  const { user } = useSession();

  const { _ } = useLingui();
  const { toast } = useToast();

  const hasTwoFactorAuthentication = user.twoFactorEnabled;

  const [enteredEmail, setEnteredEmail] = useState<string>('');

  const { mutateAsync: deleteAccount, isPending: isDeletingAccount } =
    trpc.profile.deleteAccount.useMutation();

  const onDeleteAccount = async () => {
    try {
      await deleteAccount();

      toast({
        title: _(msg`Account deleted`),
        description: _(msg`Your account has been deleted successfully.`),
        duration: 5000,
      });

      return await authClient.signOut();
    } catch (err) {
      toast({
        title: _(msg`An unknown error occurred`),
        variant: 'destructive',
        description: _(
          msg`We encountered an unknown error while attempting to delete your account. Please try again later.`,
        ),
      });
    }
  };

  return (
    <div className={className}>
      <Alert
        className="flex flex-col items-center justify-between gap-4 p-6 md:flex-row"
        variant="neutral"
      >
        <div>
          <AlertTitle>
            <Trans>Delete Account</Trans>
          </AlertTitle>
          <AlertDescription className="mr-2">
            <Trans>
              Delete your account and all its contents, including completed documents. This action
              is irreversible and will cancel your subscription, so proceed with caution.
            </Trans>
          </AlertDescription>
        </div>

        <div className="flex-shrink-0">
          <Dialog onOpenChange={() => setEnteredEmail('')}>
            <DialogTrigger asChild>
              <Button variant="destructive">
                <Trans>Delete Account</Trans>
              </Button>
            </DialogTrigger>

            <DialogContent>
              <DialogHeader className="space-y-4">
                <DialogTitle>
                  <Trans>Delete Account</Trans>
                </DialogTitle>

                <Alert variant="destructive">
                  <AlertDescription className="selection:bg-red-100">
                    <Trans>This action is not reversible. Please be certain.</Trans>
                  </AlertDescription>
                </Alert>

                {hasTwoFactorAuthentication && (
                  <Alert variant="destructive">
                    <AlertDescription className="selection:bg-red-100">
                      <Trans>Disable Two Factor Authentication before deleting your account.</Trans>
                    </AlertDescription>
                  </Alert>
                )}

                <DialogDescription>
                  <Trans>
                    Documenso will delete{' '}
                    <span className="font-semibold">all of your documents</span>, along with all of
                    your completed documents, signatures, and all other resources belonging to your
                    Account.
                  </Trans>
                </DialogDescription>
              </DialogHeader>

              {!hasTwoFactorAuthentication && (
                <div>
                  <Label>
                    <Trans>
                      Please type{' '}
                      <span className="text-muted-foreground font-semibold">{user.email}</span> to
                      confirm.
                    </Trans>
                  </Label>

                  <Input
                    type="text"
                    className="mt-2"
                    aria-label="Confirm Email"
                    value={enteredEmail}
                    onChange={(e) => setEnteredEmail(e.target.value)}
                  />
                </div>
              )}
              <DialogFooter>
                <Button
                  onClick={onDeleteAccount}
                  loading={isDeletingAccount}
                  variant="destructive"
                  disabled={hasTwoFactorAuthentication || enteredEmail !== user.email}
                >
                  {isDeletingAccount ? _(msg`Deleting account...`) : _(msg`Confirm Deletion`)}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </Alert>
    </div>
  );
};
