import { useState } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import type { User } from '@prisma/client';
import { useNavigate } from 'react-router';
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

export type AdminUserDeleteDialogProps = {
  className?: string;
  user: User;
};

export const AdminUserDeleteDialog = ({ className, user }: AdminUserDeleteDialogProps) => {
  const { _ } = useLingui();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');

  const { mutateAsync: deleteUser, isPending: isDeletingUser } =
    trpc.admin.deleteUser.useMutation();

  const onDeleteAccount = async () => {
    try {
      await deleteUser({
        id: user.id,
      });

      await navigate('/admin/users');

      toast({
        title: _(msg`Account deleted`),
        description: _(msg`The account has been deleted successfully.`),
        duration: 5000,
      });
    } catch (err) {
      const error = AppError.parseError(err);

      const errorMessage = match(error.code)
        .with(AppErrorCode.NOT_FOUND, () => msg`User not found.`)
        .with(AppErrorCode.UNAUTHORIZED, () => msg`You are not authorized to delete this user.`)
        .otherwise(() => msg`An error occurred while deleting the user.`);

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
          <AlertTitle>Delete Account</AlertTitle>
          <AlertDescription className="mr-2">
            <Trans>
              Delete the users account and all its contents. This action is irreversible and will
              cancel their subscription, so proceed with caution.
            </Trans>
          </AlertDescription>
        </div>

        <div className="flex-shrink-0">
          <Dialog>
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
              </DialogHeader>

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
                  onClick={onDeleteAccount}
                  loading={isDeletingUser}
                  variant="destructive"
                  disabled={email !== user.email}
                >
                  <Trans>Delete account</Trans>
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </Alert>
    </div>
  );
};
