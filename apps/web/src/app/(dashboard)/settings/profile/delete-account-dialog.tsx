'use client';

import { useState } from 'react';

import { signOut } from 'next-auth/react';

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
import { Label } from '@documenso/ui/primitives/label';
import { useToast } from '@documenso/ui/primitives/use-toast';

export type DeleteAccountDialogProps = {
  className?: string;
  user: User;
};

export const DeleteAccountDialog = ({ className, user }: DeleteAccountDialogProps) => {
  const { toast } = useToast();

  const hasTwoFactorAuthentication = user.twoFactorEnabled;

  const [enteredEmail, setEnteredEmail] = useState<string>('');

  const { mutateAsync: deleteAccount, isLoading: isDeletingAccount } =
    trpc.profile.deleteAccount.useMutation();

  const onDeleteAccount = async () => {
    try {
      await deleteAccount();

      toast({
        title: 'ანგარიში წაიშალა',
        description: 'თვქენი ანგარიში წარმატებით წაიშალა.',
        duration: 5000,
      });

      return await signOut({ callbackUrl: '/' });
    } catch (err) {
      if (err instanceof TRPCClientError && err.data?.code === 'BAD_REQUEST') {
        toast({
          title: 'დაფიქსირდა ხარვეზი',
          description: err.message,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'დაფიქსირდა ხარვეზი',
          variant: 'destructive',
          description:
            err.message ??
            'თქვენი ანგარიშის წაშლის მცდელობისას დაფიქსირდა ხარვეზი. Გთხოვთ სცადოთ მოგვიანებით.',
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
          <AlertTitle>ანგარიშის წაშლა</AlertTitle>
          <AlertDescription className="mr-2">
            წაშალეთ თქვენი ანგარიში ხელმოწერილი დოკუმენტების ჩათვლით. ეს ქმედება არის შეუქცევადი.
          </AlertDescription>
        </div>

        <div className="flex-shrink-0">
          <Dialog onOpenChange={() => setEnteredEmail('')}>
            <DialogTrigger asChild>
              <Button variant="destructive">ანგარიშის წაშლა</Button>
            </DialogTrigger>

            <DialogContent>
              <DialogHeader className="space-y-4">
                <DialogTitle>ანგარიშის წაშლა</DialogTitle>

                <Alert variant="destructive">
                  <AlertDescription className="selection:bg-red-100">
                    ეს ქმედება არის შეუქცევადი. დარწმუნდით სანამ განაგრძობთ!
                  </AlertDescription>
                </Alert>

                {hasTwoFactorAuthentication && (
                  <Alert variant="destructive">
                    <AlertDescription className="selection:bg-red-100">
                      გამორთეთ ორ ფაქტორიანი (2FA) ავთენტიფიკაცია თქვენი ანგარიშის წაშლამდე.
                    </AlertDescription>
                  </Alert>
                )}

                <DialogDescription>
                  ჩიქოვანები წაშლიან <span className="font-semibold">ყველა თქვენს დოკუმენტთან</span>
                  , ხელმოწერებთან და ყველა სხვა რესურსთან ერთად, რომელიც ეკუთვნის თქვენს ანგარიშს.
                </DialogDescription>
              </DialogHeader>

              {!hasTwoFactorAuthentication && (
                <div className="mt-4">
                  <Label>
                    Გთხოვთ ჩაწეროთ{' '}
                    <span className="text-muted-foreground font-semibold">{user.email}</span>{' '}
                    დადასტურებისთვის.
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
                  {isDeletingAccount ? 'ანგარიში უქმდება...' : 'გაუქმება დადასტურებულია'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </Alert>
    </div>
  );
};
