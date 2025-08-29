import { useState } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
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

export type AdminUserDisableDialogProps = {
  className?: string;
  userToDisable: TGetUserResponse;
};

export const AdminUserDisableDialog = ({
  className,
  userToDisable,
}: AdminUserDisableDialogProps) => {
  const { _ } = useLingui();
  const { toast } = useToast();

  const [email, setEmail] = useState('');

  const { mutateAsync: disableUser, isPending: isDisablingUser } =
    trpc.admin.user.disable.useMutation();

  const onDisableAccount = async () => {
    try {
      await disableUser({
        id: userToDisable.id,
      });

      toast({
        title: _(msg`Account disabled`),
        description: _(msg`The account has been disabled successfully.`),
        duration: 5000,
      });
    } catch (err) {
      const error = AppError.parseError(err);

      const errorMessage = match(error.code)
        .with(AppErrorCode.NOT_FOUND, () => msg`User not found.`)
        .with(AppErrorCode.UNAUTHORIZED, () => msg`You are not authorized to disable this user.`)
        .otherwise(() => msg`An error occurred while disabling the user.`);

      toast({
        title: _(msg`Error`),
        description: _(errorMessage),
        variant: 'destructive',
        duration: 7500,
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
          <AlertTitle>Disable Account</AlertTitle>
          <AlertDescription className="mr-2">
            <Trans>
              Disabling the user results in the user not being able to use the account. It also
              disables all the related contents such as subscription, webhooks, teams, and API keys.
            </Trans>
          </AlertDescription>
        </div>

        <div className="flex-shrink-0">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="destructive">
                <Trans>Disable Account</Trans>
              </Button>
            </DialogTrigger>

            <DialogContent>
              <DialogHeader className="space-y-4">
                <DialogTitle>
                  <Trans>Disable Account</Trans>
                </DialogTitle>

                <Alert variant="destructive">
                  <AlertDescription className="selection:bg-red-100">
                    <Trans>
                      This action is reversible, but please be careful as the account may be
                      affected permanently (e.g. their settings and contents not being restored
                      properly).
                    </Trans>
                  </AlertDescription>
                </Alert>
              </DialogHeader>

              <div>
                <DialogDescription>
                  <Trans>
                    To confirm, please enter the accounts email address <br />({userToDisable.email}
                    ).
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
                  onClick={onDisableAccount}
                  loading={isDisablingUser}
                  variant="destructive"
                  disabled={email !== userToDisable.email}
                >
                  <Trans>Disable account</Trans>
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </Alert>
    </div>
  );
};
