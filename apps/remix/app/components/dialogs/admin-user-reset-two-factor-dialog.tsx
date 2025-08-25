import { useState } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { useRevalidator } from 'react-router';
import { match } from 'ts-pattern';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { trpc } from '@documenso/trpc/react';
import type { TGetUserResponse } from '@documenso/trpc/server/admin-router/get-user.types';
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
import { useToast } from '@documenso/ui/primitives/use-toast';

export type AdminUserResetTwoFactorDialogProps = {
  className?: string;
  user: TGetUserResponse;
};

export const AdminUserResetTwoFactorDialog = ({
  className,
  user,
}: AdminUserResetTwoFactorDialogProps) => {
  const { _ } = useLingui();
  const { toast } = useToast();
  const { revalidate } = useRevalidator();
  const [email, setEmail] = useState('');
  const [open, setOpen] = useState(false);

  const { mutateAsync: resetTwoFactor, isPending: isResettingTwoFactor } =
    trpc.admin.user.resetTwoFactor.useMutation();

  const onResetTwoFactor = async () => {
    try {
      await resetTwoFactor({
        userId: user.id,
      });

      toast({
        title: _(msg`2FA Reset`),
        description: _(msg`The user's two factor authentication has been reset successfully.`),
        duration: 5000,
      });

      await revalidate();
      setOpen(false);
    } catch (err) {
      const error = AppError.parseError(err);

      const errorMessage = match(error.code)
        .with(AppErrorCode.NOT_FOUND, () => msg`User not found.`)
        .with(
          AppErrorCode.UNAUTHORIZED,
          () => msg`You are not authorized to reset two factor authentcation for this user.`,
        )
        .otherwise(
          () => msg`An error occurred while resetting two factor authentication for the user.`,
        );

      toast({
        title: _(msg`Error`),
        description: _(errorMessage),
        variant: 'destructive',
        duration: 7500,
      });
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);

    if (!newOpen) {
      setEmail('');
    }
  };

  return (
    <div className={className}>
      <Alert
        className="flex flex-col items-center justify-between gap-4 p-6 md:flex-row"
        variant="neutral"
      >
        <div>
          <AlertTitle>Reset Two Factor Authentication</AlertTitle>
          <AlertDescription className="mr-2">
            <Trans>
              Reset the users two factor authentication. This action is irreversible and will
              disable two factor authentication for the user.
            </Trans>
          </AlertDescription>
        </div>

        <div className="flex-shrink-0">
          <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
              <Button variant="destructive">
                <Trans>Reset 2FA</Trans>
              </Button>
            </DialogTrigger>

            <DialogContent>
              <DialogHeader className="space-y-4">
                <DialogTitle>
                  <Trans>Reset Two Factor Authentication</Trans>
                </DialogTitle>
              </DialogHeader>

              <Alert variant="destructive">
                <AlertDescription className="selection:bg-red-100">
                  <Trans>
                    This action is irreversible. Please ensure you have informed the user before
                    proceeding.
                  </Trans>
                </AlertDescription>
              </Alert>

              <div>
                <DialogDescription>
                  <Trans>
                    To confirm, please enter the accounts email address <br />({user.email}).
                  </Trans>
                </DialogDescription>

                <Input
                  className="mt-2"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <DialogFooter>
                <Button
                  variant="destructive"
                  disabled={email !== user.email}
                  onClick={onResetTwoFactor}
                  loading={isResettingTwoFactor}
                >
                  <Trans>Reset 2FA</Trans>
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </Alert>
    </div>
  );
};
