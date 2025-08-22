import { useEffect, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import type { TeamEmail } from '@prisma/client';
import type * as DialogPrimitive from '@radix-ui/react-dialog';
import { useForm } from 'react-hook-form';
import { useRevalidator } from 'react-router';
import { z } from 'zod';

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
import { useToast } from '@documenso/ui/primitives/use-toast';

export type TeamEmailUpdateDialogProps = {
  teamEmail: TeamEmail;
  trigger?: React.ReactNode;
} & Omit<DialogPrimitive.DialogProps, 'children'>;

const ZUpdateTeamEmailFormSchema = z.object({
  name: z.string().trim().min(1, { message: 'Please enter a valid name.' }),
});

type TUpdateTeamEmailFormSchema = z.infer<typeof ZUpdateTeamEmailFormSchema>;

export const TeamEmailUpdateDialog = ({
  teamEmail,
  trigger,
  ...props
}: TeamEmailUpdateDialogProps) => {
  const [open, setOpen] = useState(false);

  const { _ } = useLingui();
  const { toast } = useToast();
  const { revalidate } = useRevalidator();

  const form = useForm<TUpdateTeamEmailFormSchema>({
    resolver: zodResolver(ZUpdateTeamEmailFormSchema),
    defaultValues: {
      name: teamEmail.name,
    },
  });

  const { mutateAsync: updateTeamEmail } = trpc.team.email.update.useMutation();

  const onFormSubmit = async ({ name }: TUpdateTeamEmailFormSchema) => {
    try {
      await updateTeamEmail({
        teamId: teamEmail.teamId,
        data: {
          name,
        },
      });

      toast({
        title: _(msg`Success`),
        description: _(msg`Team email was updated.`),
        duration: 5000,
      });

      await revalidate();

      setOpen(false);
    } catch (err) {
      toast({
        title: _(msg`An unknown error occurred`),
        description: _(
          msg`We encountered an unknown error while attempting update the team email. Please try again later.`,
        ),
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    if (!open) {
      form.reset();
    }
  }, [open, form]);

  return (
    <Dialog
      {...props}
      open={open}
      onOpenChange={(value) => !form.formState.isSubmitting && setOpen(value)}
    >
      <DialogTrigger onClick={(e) => e.stopPropagation()} asChild>
        {trigger ?? (
          <Button variant="outline" className="bg-background">
            <Trans>Update team email</Trans>
          </Button>
        )}
      </DialogTrigger>

      <DialogContent position="center">
        <DialogHeader>
          <DialogTitle>
            <Trans>Update team email</Trans>
          </DialogTitle>

          <DialogDescription className="mt-4">
            <Trans>To change the email you must remove and add a new email address.</Trans>
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
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>
                      <Trans>Name</Trans>
                    </FormLabel>
                    <FormControl>
                      <Input className="bg-background" placeholder="eg. Legal" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormItem>
                <FormLabel required>
                  <Trans>Email</Trans>
                </FormLabel>
                <FormControl>
                  <Input className="bg-background" value={teamEmail.email} disabled={true} />
                </FormControl>
              </FormItem>

              <DialogFooter>
                <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                  <Trans>Cancel</Trans>
                </Button>

                <Button type="submit" loading={form.formState.isSubmitting}>
                  <Trans>Update</Trans>
                </Button>
              </DialogFooter>
            </fieldset>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
