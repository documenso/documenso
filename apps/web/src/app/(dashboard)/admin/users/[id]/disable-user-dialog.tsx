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

export type DisableUserDialogProps = {
  className?: string;
  user: User;
};

export const DisableUserDialog = ({ className, user }: DisableUserDialogProps) => {
  const { toast } = useToast();
  const { _ } = useLingui();

  const router = useRouter();

  const [email, setEmail] = useState('');

  const { mutateAsync: disableUser, isLoading: isDisablingUser } =
    trpc.admin.disableUser.useMutation();

  const onDisableAccount = async () => {
    try {
      await disableUser({
        id: user.id,
        email,
      });

      toast({
        title: _(msg`Account disabled`),
        description: _(msg`The account has been disabled successfully.`),
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
              msg`We encountered an unknown error while attempting to disable the account. Please try again later.`,
            ),
        });
      }
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
                  onClick={onDisableAccount}
                  loading={isDisablingUser}
                  variant="destructive"
                  disabled={email !== user.email}
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
