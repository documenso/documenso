import { useEffect, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { z } from 'zod';

import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
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
import { useToast } from '@documenso/ui/primitives/use-toast';

export type OrganisationDeleteDialogProps = {
  trigger?: React.ReactNode;
};

export const OrganisationDeleteDialog = ({ trigger }: OrganisationDeleteDialogProps) => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const { _ } = useLingui();
  const { toast } = useToast();

  const organisation = useCurrentOrganisation();

  const deleteMessage = _(msg`delete ${organisation.name}`);

  const ZDeleteOrganisationFormSchema = z.object({
    organisationName: z.literal(deleteMessage, {
      errorMap: () => ({ message: _(msg`You must enter '${deleteMessage}' to proceed`) }),
    }),
  });

  const form = useForm({
    resolver: zodResolver(ZDeleteOrganisationFormSchema),
    defaultValues: {
      organisationName: '',
    },
  });

  const { mutateAsync: deleteOrganisation } = trpc.organisation.delete.useMutation();

  const onFormSubmit = async () => {
    try {
      await deleteOrganisation({ organisationId: organisation.id });

      toast({
        title: _(msg`Success`),
        description: _(msg`Your organisation has been successfully deleted.`),
        duration: 5000,
      });

      await navigate('/settings/organisations');

      setOpen(false);
    } catch (err) {
      const error = AppError.parseError(err);
      console.error(error);

      toast({
        title: _(msg`An unknown error occurred`),
        description: _(
          msg`We encountered an unknown error while attempting to delete this organisation. Please try again later.`,
        ),
        variant: 'destructive',
        duration: 10000,
      });
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
            <Trans>Are you sure you wish to delete this organisation?</Trans>
          </DialogTitle>

          <DialogDescription>
            <Trans>
              You are about to delete <span className="font-semibold">{organisation.name}</span>.
              All data related to this organisation such as teams, documents, and all other
              resources will be deleted. This action is irreversible.
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
                name="organisationName"
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
