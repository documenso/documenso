import { useState } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import type { User } from '@prisma/client';
import { match } from 'ts-pattern';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
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
import { useToast } from '@documenso/ui/primitives/use-toast';

export type AdminUserEnableDialogProps = {
  className?: string;
  userToEnable: User;
};

export const AdminUserEnableDialog = ({ className, userToEnable }: AdminUserEnableDialogProps) => {
  const { toast } = useToast();
  const { _ } = useLingui();

  const [email, setEmail] = useState('');

  const { mutateAsync: enableUser, isPending: isEnablingUser } =
    trpc.admin.enableUser.useMutation();

  const onEnableAccount = async () => {
    try {
      await enableUser({
        id: userToEnable.id,
      });

      toast({
        title: _(msg`Account enabled`),
        description: _(msg`The account has been enabled successfully.`),
        duration: 5000,
      });
    } catch (err) {
      const error = AppError.parseError(err);

      const errorMessage = match(error.code)
        .with(AppErrorCode.NOT_FOUND, () => msg`User not found.`)
        .with(AppErrorCode.UNAUTHORIZED, () => msg`You are not authorized to enable this user.`)
        .otherwise(() => msg`An error occurred while enabling the user.`);

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
          <AlertTitle>Enable Account</AlertTitle>
          <AlertDescription className="mr-2">
            <Trans>
              Enabling the account results in the user being able to use the account again, and all
              the related features such as webhooks, teams, and API keys for example.
            </Trans>
          </AlertDescription>
        </div>

        <div className="flex-shrink-0">
          <Dialog>
            <DialogTrigger asChild>
              <Button>
                <Trans>Enable Account</Trans>
              </Button>
            </DialogTrigger>

            <DialogContent>
              <DialogHeader className="space-y-4">
                <DialogTitle>
                  <Trans>Enable Account</Trans>
                </DialogTitle>
              </DialogHeader>

              <div>
                <DialogDescription>
                  <Trans>
                    To confirm, please enter the accounts email address <br />({userToEnable.email}
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
                  onClick={onEnableAccount}
                  loading={isEnablingUser}
                  disabled={email !== userToEnable.email}
                >
                  <Trans>Enable account</Trans>
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </Alert>
    </div>
  );
};
