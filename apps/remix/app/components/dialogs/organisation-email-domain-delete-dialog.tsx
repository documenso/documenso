import { useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useLingui } from '@lingui/react/macro';
import { Trans } from '@lingui/react/macro';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
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

export type OrganisationEmailDomainDeleteDialogProps = {
  emailDomainId: string;
  emailDomain: string;
  trigger?: React.ReactNode;
};

export const OrganisationEmailDomainDeleteDialog = ({
  trigger,
  emailDomainId,
  emailDomain,
}: OrganisationEmailDomainDeleteDialogProps) => {
  const [open, setOpen] = useState(false);

  const { t } = useLingui();
  const { toast } = useToast();

  const organisation = useCurrentOrganisation();

  const deleteMessage = t`delete ${emailDomain}`;

  const ZDeleteEmailDomainFormSchema = z.object({
    confirmText: z.literal(deleteMessage, {
      errorMap: () => ({ message: t`You must type '${deleteMessage}' to confirm` }),
    }),
  });

  const form = useForm<z.infer<typeof ZDeleteEmailDomainFormSchema>>({
    resolver: zodResolver(ZDeleteEmailDomainFormSchema),
    defaultValues: {
      confirmText: '',
    },
  });

  const { mutateAsync: deleteEmailDomain, isPending: isDeleting } =
    trpc.enterprise.organisation.emailDomain.delete.useMutation({
      onSuccess: () => {
        toast({
          title: t`Success`,
          description: t`You have successfully removed this email domain from the organisation.`,
          duration: 5000,
        });

        setOpen(false);
      },
      onError: () => {
        toast({
          title: t`An unknown error occurred`,
          description: t`We encountered an unknown error while attempting to remove this email domain. Please try again later.`,
          variant: 'destructive',
          duration: 10000,
        });
      },
    });

  const onFormSubmit = async () => {
    await deleteEmailDomain({
      emailDomainId,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !isDeleting && setOpen(value)}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="secondary">
            <Trans>Delete email domain</Trans>
          </Button>
        )}
      </DialogTrigger>

      <DialogContent position="center">
        <DialogHeader>
          <DialogTitle>
            <Trans>Are you sure?</Trans>
          </DialogTitle>

          <DialogDescription className="mt-4">
            <Trans>
              You are about to remove the email domain{' '}
              <span className="font-semibold">{emailDomain}</span> from{' '}
              <span className="font-semibold">{organisation.name}</span>. All emails associated with
              this domain will be deleted.
            </Trans>
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onFormSubmit)}>
            <fieldset disabled={form.formState.isSubmitting} className="space-y-4">
              <FormField
                control={form.control}
                name="confirmText"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      <Trans>
                        Confirm by typing{' '}
                        <span className="font-sm text-destructive font-semibold">
                          {deleteMessage}
                        </span>
                      </Trans>
                    </FormLabel>
                    <FormControl>
                      <Input placeholder={deleteMessage} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                  <Trans>Cancel</Trans>
                </Button>
                <Button
                  variant="destructive"
                  type="submit"
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
};
