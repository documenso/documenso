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
          title: 'Success',
          description: 'Passkey has been updated',
        });
      },
      onError: () => {
        toast({
          title: 'Something went wrong',
          description:
            'We are unable to update this passkey at the moment. Please try again later.',
          duration: 10000,
          variant: 'destructive',
        });
      },
    });

  const { mutateAsync: deletePasskey, isLoading: isDeletingPasskey } =
    trpc.auth.deletePasskey.useMutation({
      onSuccess: () => {
        toast({
          title: 'Success',
          description: 'Passkey has been removed',
        });
      },
      onError: () => {
        toast({
          title: 'Something went wrong',
          description:
            'We are unable to remove this passkey at the moment. Please try again later.',
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
          <Button variant="outline">Edit</Button>
        </DialogTrigger>

        <DialogContent position="center">
          <DialogHeader>
            <DialogTitle>Update passkey</DialogTitle>

            <DialogDescription className="mt-4">
              You are currently updating the <strong>{passkeyName}</strong> passkey.
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
                      <FormLabel required>Name</FormLabel>
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
                      Cancel
                    </Button>
                  </DialogClose>

                  <Button type="submit" loading={isUpdatingPasskey}>
                    Update
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
          <Button variant="destructive">Delete</Button>
        </DialogTrigger>

        <DialogContent position="center">
          <DialogHeader>
            <DialogTitle>Delete passkey</DialogTitle>

            <DialogDescription className="mt-4">
              Are you sure you want to remove the <strong>{passkeyName}</strong> passkey.
            </DialogDescription>
          </DialogHeader>

          <fieldset disabled={isDeletingPasskey}>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="secondary">
                  Cancel
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
                Delete
              </Button>
            </DialogFooter>
          </fieldset>
        </DialogContent>
      </Dialog>
    </div>
  );
};
