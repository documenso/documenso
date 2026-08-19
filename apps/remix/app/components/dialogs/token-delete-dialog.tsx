import { trpc } from '@documenso/trpc/react';
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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@documenso/ui/primitives/form/form';
import { Input } from '@documenso/ui/primitives/input';
import { useToast } from '@documenso/ui/primitives/use-toast';
import { zodResolver } from '@hookform/resolvers/zod';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import type { ApiToken } from '@prisma/client';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { useCurrentTeam } from '~/providers/team';

export type TokenDeleteDialogProps = {
  token: Pick<ApiToken, 'id' | 'name'>;
  onDelete?: () => void;
  children?: React.ReactNode;
};

export default function TokenDeleteDialog({ token, onDelete, children }: TokenDeleteDialogProps) {
  const { _ } = useLingui();
  const { toast } = useToast();

  const team = useCurrentTeam();

  const [isOpen, setIsOpen] = useState(false);

  const deleteMessage = _(msg`delete ${token.name}`);

  const ZTokenDeleteDialogSchema = z.object({
    tokenName: z.literal(deleteMessage, {
      errorMap: () => ({ message: _(msg`You must enter '${deleteMessage}' to proceed`) }),
    }),
  });

  type TDeleteTokenByIdMutationSchema = z.infer<typeof ZTokenDeleteDialogSchema>;

  const { mutateAsync: deleteTokenMutation } = trpc.apiToken.delete.useMutation({
    onSuccess() {
      onDelete?.();
    },
  });

  const form = useForm<TDeleteTokenByIdMutationSchema>({
    resolver: zodResolver(ZTokenDeleteDialogSchema),
    values: {
      tokenName: '',
    },
  });

  const onSubmit = async () => {
    try {
      await deleteTokenMutation({
        id: token.id,
        teamId: team?.id,
      });

      toast({
        title: _(msg`Token deleted`),
        description: _(msg`The token was deleted successfully.`),
        duration: 5000,
      });

      setIsOpen(false);
    } catch (error) {
      toast({
        title: _(msg`An unknown error occurred`),
        description: _(
          msg`We encountered an unknown error while attempting to delete this token. Please try again later.`,
        ),
        variant: 'destructive',
        duration: 5000,
      });
    }
  };

  useEffect(() => {
    if (!isOpen) {
      form.reset();
    }
  }, [isOpen, form]);

  return (
    <Dialog open={isOpen} onOpenChange={(value) => !form.formState.isSubmitting && setIsOpen(value)}>
      <DialogTrigger asChild={true}>
        {children ?? (
          <Button className="mr-4" variant="destructive">
            <Trans>Delete</Trans>
          </Button>
        )}
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            <Trans>Delete token</Trans>
          </DialogTitle>

          <DialogDescription>
            <Trans>
              Please note that this action is irreversible. Once confirmed, your token will be permanently deleted.
            </Trans>
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <fieldset className="flex h-full flex-col space-y-4" disabled={form.formState.isSubmitting}>
              <FormField
                control={form.control}
                name="tokenName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      <Trans>
                        Confirm by typing:{' '}
                        <span className="font-semibold text-destructive text-sm">{deleteMessage}</span>
                      </Trans>
                    </FormLabel>

                    <FormControl>
                      <Input className="bg-background" type="text" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="secondary" onClick={() => setIsOpen(false)}>
                  <Trans>Cancel</Trans>
                </Button>

                <Button
                  type="submit"
                  variant="destructive"
                  disabled={!form.formState.isValid}
                  loading={form.formState.isSubmitting}
                >
                  <Trans>Delete</Trans>
                </Button>
              </DialogFooter>
            </fieldset>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
