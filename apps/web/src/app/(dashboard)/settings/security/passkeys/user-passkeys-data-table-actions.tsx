import { useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { trpc } from '@documenso/trpc/react';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@documenso/ui/primitives/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@documenso/ui/primitives/form/form';
import { Input } from '@documenso/ui/primitives/input';
import { useToast } from '@documenso/ui/primitives/use-toast';

export type UserPasskeysDataTableActionsProps = {
  className?: string;
  passkeyId: string;
  passkeyName: string;
};

const ZUpdatePasskeySchema = z.object({
  name: z.string(),
});

type TUpdatePasskeySchema = z.infer<typeof ZUpdatePasskeySchema>;

export const UserPasskeysDataTableActions = ({
  className,
  passkeyId,
  passkeyName,
}: UserPasskeysDataTableActionsProps) => {
  const { toast } = useToast();

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isUpdateDialogOpen, setIsUpdateDialogOpen] = useState(false);

  const form = useForm<TUpdatePasskeySchema>({
    resolver: zodResolver(ZUpdatePasskeySchema),
    defaultValues: {
      name: passkeyName,
    },
  });

  const { mutateAsync: updatePasskey, isLoading: isUpdatingPasskey } =
    trpc.auth.updatePasskey.useMutation({
      onSuccess: () => {
        toast({
          title: '',
          description: 'Passkey განახლებულია',
        });
      },
      onError: () => {
        toast({
          title: 'დაფიქსირდა ხარვეზი',
          description: 'ჩვენ ვერ ვახერხებთ ამ Passkey განახლებას. Გთხოვთ სცადოთ მოგვიანებით.',
          duration: 10000,
          variant: 'destructive',
        });
      },
    });

  const { mutateAsync: deletePasskey, isLoading: isDeletingPasskey } =
    trpc.auth.deletePasskey.useMutation({
      onSuccess: () => {
        toast({
          title: '',
          description: 'Passkey წაიშალა',
        });
      },
      onError: () => {
        toast({
          title: 'დაფიქსირდა ხარვეზი',
          description: 'Passkey წაშლა ვერ მოხერხდა. გთხოვთ თავიდან სცადოთ.',
          duration: 10000,
          variant: 'destructive',
        });
      },
    });

  return (
    <div className={cn('flex justify-end space-x-2', className)}>
      <Dialog
        open={isUpdateDialogOpen}
        onOpenChange={(value) => !isUpdatingPasskey && setIsUpdateDialogOpen(value)}
      >
        <DialogTrigger onClick={(e) => e.stopPropagation()} asChild>
          <Button variant="outline">რედაქტირება</Button>
        </DialogTrigger>

        <DialogContent position="center">
          <DialogHeader>
            <DialogTitle>განაახლეთ passkey</DialogTitle>

            <DialogDescription className="mt-4">
              თქვენ ახლა ანახლებთ <strong>{passkeyName}</strong> passkey.
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(async ({ name }) =>
                updatePasskey({
                  passkeyId,
                  name,
                }),
              )}
            >
              <fieldset className="flex h-full flex-col" disabled={isUpdatingPasskey}>
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem className="w-full">
                      <FormLabel required>სახელი</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter className="mt-4">
                  <DialogClose asChild>
                    <Button type="button" variant="secondary">
                      დახურვა
                    </Button>
                  </DialogClose>

                  <Button type="submit" loading={isUpdatingPasskey}>
                    განალება
                  </Button>
                </DialogFooter>
              </fieldset>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isDeleteDialogOpen}
        onOpenChange={(value) => !isDeletingPasskey && setIsDeleteDialogOpen(value)}
      >
        <DialogTrigger onClick={(e) => e.stopPropagation()} asChild={true}>
          <Button variant="destructive">წაშლა</Button>
        </DialogTrigger>

        <DialogContent position="center">
          <DialogHeader>
            <DialogTitle>passkey წაშლა</DialogTitle>

            <DialogDescription className="mt-4">
              დარწმუნებული ხართ, რომ გსურთ წაშალოთ <strong>{passkeyName}</strong> passkey?
            </DialogDescription>
          </DialogHeader>

          <fieldset disabled={isDeletingPasskey}>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="secondary">
                  დახურვა
                </Button>
              </DialogClose>

              <Button
                onClick={async () =>
                  deletePasskey({
                    passkeyId,
                  })
                }
                variant="destructive"
                loading={isDeletingPasskey}
              >
                წაშლა
              </Button>
            </DialogFooter>
          </fieldset>
        </DialogContent>
      </Dialog>
    </div>
  );
};
