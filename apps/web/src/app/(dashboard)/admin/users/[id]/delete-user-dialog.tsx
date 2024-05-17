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
        title: 'ანგარიში წაშლილია',
        description: 'ანგარიში წარმატებით წაიშალა!.',
        duration: 5000,
      });

      router.push('/admin/users');
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
            'თქვენი ანგარიშის წაშლისას დაფიქსირდა ხარვეზი. გთხოვთ თავიდან სცადოთ ან დაგვიკავშირდეთ.',
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
            წაშალეთ მომხმარებლის ანგარიში მასში შემავალი ყველა ინფორმაციით. ეს ქმედება შეუქცევადია,
            ამიტომ დარწმუნდით, სანამ განაგრძობთ.
          </AlertDescription>
        </div>

        <div className="flex-shrink-0">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="destructive">ანგარიშის წაშლა</Button>
            </DialogTrigger>

            <DialogContent>
              <DialogHeader className="space-y-4">
                <DialogTitle>ანგარიშის წაშლა</DialogTitle>

                <Alert variant="destructive">
                  <AlertDescription className="selection:bg-red-100">
                    ეს ქმედება არ შეუქცევადი. გთხოვთ დარწმუნდით, სანამ განაგრძობთ.
                  </AlertDescription>
                </Alert>
              </DialogHeader>

              <div>
                <DialogDescription>
                  დადასტურებისთვის, გთხოვთ შეიყვანოთ ანგარიშის ელ.ფოსტის მისამართი <br />(
                  {user.email}).
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
                  {isDeletingUser ? 'ანგარიში იშლება...' : 'ანგარიშის წაშლა'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </Alert>
    </div>
  );
};
