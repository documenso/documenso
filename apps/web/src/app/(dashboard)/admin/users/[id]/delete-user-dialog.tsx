'use client';

import { useState } from 'react';

import { useRouter } from 'next/navigation';

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
  const router = useRouter();
  const { toast } = useToast();

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
        title: 'Account deleted',
        description: 'The account has been deleted successfully.',
        duration: 5000,
      });

      router.push('/admin/users');
    } catch (err) {
      if (err instanceof TRPCClientError && err.data?.code === 'BAD_REQUEST') {
        toast({
          title: 'An error occurred',
          description: err.message,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'An unknown error occurred',
          variant: 'destructive',
          description:
            err.message ??
            'We encountered an unknown error while attempting to delete your account. Please try again later.',
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
            Delete the users account and all its contents. This action is irreversible and will
            cancel their subscription, so proceed with caution.
          </AlertDescription>
        </div>

        <div className="flex-shrink-0">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="destructive">Delete Account</Button>
            </DialogTrigger>

            <DialogContent>
              <DialogHeader className="space-y-4">
                <DialogTitle>Delete Account</DialogTitle>

                <Alert variant="destructive">
                  <AlertDescription className="selection:bg-red-100">
                    This action is not reversible. Please be certain.
                  </AlertDescription>
                </Alert>
              </DialogHeader>

              <div>
                <DialogDescription>
                  To confirm, please enter the accounts email address <br />({user.email}).
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
                  {isDeletingUser ? 'Deleting account...' : 'Delete Account'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </Alert>
    </div>
  );
};
