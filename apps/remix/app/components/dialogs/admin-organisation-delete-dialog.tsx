import { AppError } from '@documenso/lib/errors/app-error';
import { trpc } from '@documenso/trpc/react';
import { Alert, AlertDescription } from '@documenso/ui/primitives/alert';
import { Button } from '@documenso/ui/primitives/button';
import { Checkbox } from '@documenso/ui/primitives/checkbox';
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
import { Trans, useLingui } from '@lingui/react/macro';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

export type AdminOrganisationDeleteDialogProps = {
  organisationId: string;
  organisationName: string;
  trigger?: React.ReactNode;
};

export const AdminOrganisationDeleteDialog = ({
  organisationId,
  organisationName,
  trigger,
}: AdminOrganisationDeleteDialogProps) => {
  const [open, setOpen] = useState(false);

  const { t } = useLingui();
  const { toast } = useToast();

  const deleteMessage = t`delete ${organisationName}`;

  const ZAdminDeleteOrganisationFormSchema = z.object({
    organisationName: z.literal(deleteMessage, {
      errorMap: () => ({ message: t`You must enter '${deleteMessage}' to proceed` }),
    }),
    sendEmailToOwner: z.boolean(),
  });

  type TAdminDeleteOrganisationFormSchema = z.infer<typeof ZAdminDeleteOrganisationFormSchema>;

  const form = useForm<TAdminDeleteOrganisationFormSchema>({
    resolver: zodResolver(ZAdminDeleteOrganisationFormSchema),
    defaultValues: {
      organisationName: '',
      sendEmailToOwner: true,
    },
  });

  const { mutateAsync: deleteOrganisation } = trpc.admin.organisation.delete.useMutation();

  const onFormSubmit = async (values: TAdminDeleteOrganisationFormSchema) => {
    try {
      await deleteOrganisation({
        organisationId,
        organisationName,
        sendEmailToOwner: values.sendEmailToOwner,
      });

      toast({
        title: t`Deletion scheduled`,
        description: t`The organisation will be deleted in the background. Documents will be orphaned, not deleted.`,
        duration: 7500,
      });

      setOpen(false);
    } catch (err) {
      const error = AppError.parseError(err);
      console.error(error);

      toast({
        title: t`An error occurred`,
        description: t`We encountered an error while attempting to delete this organisation. Please try again later.`,
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
            <Trans>Delete organisation</Trans>
          </DialogTitle>

          <DialogDescription>
            <Trans>
              You are about to delete <span className="font-semibold">{organisationName}</span>. This action is not
              reversible. All teams will be removed and all documents will be orphaned to the deleted-account service
              account.
            </Trans>
          </DialogDescription>
        </DialogHeader>

        <Alert variant="destructive">
          <AlertDescription>
            <Trans>
              The deletion will run in the background, and can take up to a few minutes to complete. Do not re-run this
              deletion.
            </Trans>
          </AlertDescription>
        </Alert>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onFormSubmit)}>
            <fieldset className="flex h-full flex-col space-y-4" disabled={form.formState.isSubmitting}>
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

              <FormField
                control={form.control}
                name="sendEmailToOwner"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        id="admin-delete-organisation-send-email"
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>

                    <label
                      htmlFor="admin-delete-organisation-send-email"
                      className="font-normal text-muted-foreground text-sm leading-snug"
                    >
                      <Trans>Email the organisation owner to notify them of the deletion.</Trans>
                    </label>
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
