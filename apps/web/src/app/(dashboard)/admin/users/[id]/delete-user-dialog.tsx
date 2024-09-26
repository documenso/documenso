'use client';

import { useState } from 'react';

import { useRouter } from 'next/navigation';

import { Trans, msg } from '@lingui/macro';
import { useLingui } from '@lingui/react';

import type { User } from '@documenso/prisma/client';
import { TRPCClientError } from '@documenso/trpc/client';
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

export type DeleteUserDialogProps = {
  className?: string;
  user: User;
};

export const DeleteUserDialog = ({ className, user }: DeleteUserDialogProps) => {
  const { toast } = useToast();
  const { _ } = useLingui();

  const router = useRouter();

  const [email, setEmail] = useState('');

  const { mutateAsync: deleteUser, isLoading: isDeletingUser } =
    trpc.admin.deleteUser.useMutation();

  const onDeleteAccount = async () => {
    try {
      await deleteUser({
        id: user.id,
        email,
      });

      toast({
        title: _(msg`Account deleted`),
        description: _(msg`The account has been deleted successfully.`),
        duration: 5000,
      });

      router.push('/admin/users');
    } catch (err) {
      if (err instanceof TRPCClientError && err.data?.code === 'BAD_REQUEST') {
        toast({
          title: _(msg`An error occurred`),
          description: err.message,
          variant: 'destructive',
        });
      } else {
        toast({
          title: _(msg`An unknown error occurred`),
          variant: 'destructive',
          description:
            err.message ??
            _(
              msg`We encountered an unknown error while attempting to delete your account. Please try again later.`,
            ),
        });
      }
    }
  };

  return (
    <div className={className}>
      <Alert
        className="flex flex-col items-center justify-between gap-4 p-6 md:flex-row "
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
