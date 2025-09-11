import { useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
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

export type SettingsSecurityPasskeyTableActionsProps = {
  className?: string;
  passkeyId: string;
  passkeyName: string;
};

const ZUpdatePasskeySchema = z.object({
  name: z.string(),
});

type TUpdatePasskeySchema = z.infer<typeof ZUpdatePasskeySchema>;

export const SettingsSecurityPasskeyTableActions = ({
  className,
  passkeyId,
  passkeyName,
}: SettingsSecurityPasskeyTableActionsProps) => {
  const { _ } = useLingui();
  const { toast } = useToast();

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isUpdateDialogOpen, setIsUpdateDialogOpen] = useState(false);

  const form = useForm<TUpdatePasskeySchema>({
    resolver: zodResolver(ZUpdatePasskeySchema),
    defaultValues: {
      name: passkeyName,
    },
  });

  const { mutateAsync: updatePasskey, isPending: isUpdatingPasskey } =
    trpc.auth.passkey.update.useMutation({
      onSuccess: () => {
        toast({
          title: _(msg`Success`),
          description: _(msg`Passkey has been updated`),
        });

        setIsUpdateDialogOpen(false);
      },
      onError: () => {
        toast({
          title: _(msg`Something went wrong`),
          description: _(
            msg`We are unable to update this passkey at the moment. Please try again later.`,
          ),
          duration: 10000,
          variant: 'destructive',
        });
      },
    });

  const { mutateAsync: deletePasskey, isPending: isDeletingPasskey } =
    trpc.auth.passkey.delete.useMutation({
      onSuccess: () => {
        toast({
          title: _(msg`Success`),
          description: _(msg`Passkey has been removed`),
        });

        setIsDeleteDialogOpen(false);
      },
      onError: () => {
        toast({
          title: _(msg`Something went wrong`),
          description: _(
            msg`We are unable to remove this passkey at the moment. Please try again later.`,
          ),
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
          <Button variant="outline">
            <Trans>Edit</Trans>
          </Button>
        </DialogTrigger>

        <DialogContent position="center">
          <DialogHeader>
            <DialogTitle>
              <Trans>Update passkey</Trans>
            </DialogTitle>

            <DialogDescription className="mt-4">
              <Trans>
                You are currently updating the <strong>{passkeyName}</strong> passkey.
              </Trans>
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
                      <FormLabel required>
                        <Trans>Name</Trans>
                      </FormLabel>
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
                      <Trans>Cancel</Trans>
                    </Button>
                  </DialogClose>

                  <Button type="submit" loading={isUpdatingPasskey}>
                    <Trans>Update</Trans>
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
          <Button variant="destructive">
            <Trans>Delete</Trans>
          </Button>
        </DialogTrigger>

        <DialogContent position="center">
          <DialogHeader>
            <DialogTitle>
              <Trans>Delete passkey</Trans>
            </DialogTitle>

            <DialogDescription className="mt-4">
              <Trans>
                Are you sure you want to remove the <strong>{passkeyName}</strong> passkey?
              </Trans>
            </DialogDescription>
          </DialogHeader>

          <fieldset disabled={isDeletingPasskey}>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="secondary">
                  <Trans>Cancel</Trans>
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
                <Trans>Delete</Trans>
              </Button>
            </DialogFooter>
          </fieldset>
        </DialogContent>
      </Dialog>
    </div>
  );
};
