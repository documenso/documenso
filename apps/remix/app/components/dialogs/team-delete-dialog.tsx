import { useEffect, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { z } from 'zod';

import { useSession } from '@documenso/lib/client-only/providers/session';
import { AppError } from '@documenso/lib/errors/app-error';
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@documenso/ui/primitives/form/form';
import { Input } from '@documenso/ui/primitives/input';
import type { Toast } from '@documenso/ui/primitives/use-toast';
import { useToast } from '@documenso/ui/primitives/use-toast';

export type TeamDeleteDialogProps = {
  teamId: number;
  teamName: string;
  redirectTo?: string;
  trigger?: React.ReactNode;
};

export const TeamDeleteDialog = ({
  trigger,
  teamId,
  teamName,
  redirectTo,
}: TeamDeleteDialogProps) => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const { _ } = useLingui();
  const { toast } = useToast();
  const { refreshSession } = useSession();

  const deleteMessage = _(msg`delete ${teamName}`);

  const ZDeleteTeamFormSchema = z.object({
    teamName: z.literal(deleteMessage, {
      errorMap: () => ({ message: _(msg`You must enter '${deleteMessage}' to proceed`) }),
    }),
  });

  const form = useForm({
    resolver: zodResolver(ZDeleteTeamFormSchema),
    defaultValues: {
      teamName: '',
    },
  });

  const { mutateAsync: deleteTeam } = trpc.team.delete.useMutation();

  const onFormSubmit = async () => {
    try {
      await deleteTeam({ teamId });

      await refreshSession();

      toast({
        title: _(msg`Success`),
        description: _(msg`Your team has been successfully deleted.`),
        duration: 5000,
      });

      if (redirectTo) {
        await navigate(redirectTo);
      }

      setOpen(false);
    } catch (err) {
      const error = AppError.parseError(err);

      let toastError: Toast = {
        title: _(msg`An unknown error occurred`),
        description: _(
          msg`We encountered an unknown error while attempting to delete this team. Please try again later.`,
        ),
        variant: 'destructive',
        duration: 10000,
      };

      if (error.code === 'resource_missing') {
        toastError = {
          title: _(msg`Unable to delete team`),
          description: _(
            msg`Something went wrong while updating the team billing subscription, please contact support.`,
          ),
          variant: 'destructive',
          duration: 15000,
        };
      }

      toast(toastError);
    }
  };

  useEffect(() => {
    if (!open) {
      form.reset();
    }
  }, [open, form]);

  return (
    <Dialog open={open} onOpenChange={(value) => !form.formState.isSubmitting && setOpen(value)}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="destructive">
            <Trans>Delete</Trans>
          </Button>
        )}
      </DialogTrigger>

      <DialogContent position="center">
        <DialogHeader>
          <DialogTitle>
            <Trans>Are you sure you wish to delete this team?</Trans>
          </DialogTitle>

          <DialogDescription className="mt-4">
            <Trans>
              Please note that you will lose access to all documents associated with this team & all
              the members will be removed and notified
            </Trans>
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onFormSubmit)}>
            <fieldset
              className="flex h-full flex-col space-y-4"
              disabled={form.formState.isSubmitting}
            >
              <FormField
                control={form.control}
                name="teamName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      <Trans>
                        Confirm by typing <span className="text-destructive">{deleteMessage}</span>
                      </Trans>
                    </FormLabel>
                    <FormControl>
                      <Input className="bg-background" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                  <Trans>Cancel</Trans>
                </Button>

                <Button type="submit" variant="destructive" loading={form.formState.isSubmitting}>
                  <Trans>Delete</Trans>
                </Button>
              </DialogFooter>
            </fieldset>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
