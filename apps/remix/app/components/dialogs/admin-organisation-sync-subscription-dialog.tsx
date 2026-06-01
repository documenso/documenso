import { AppError } from '@documenso/lib/errors/app-error';
import { trpc } from '@documenso/trpc/react';
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
import { Form, FormControl, FormField, FormItem } from '@documenso/ui/primitives/form/form';
import { useToast } from '@documenso/ui/primitives/use-toast';
import { zodResolver } from '@hookform/resolvers/zod';
import { Trans, useLingui } from '@lingui/react/macro';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { z } from 'zod';

export type AdminOrganisationSyncSubscriptionDialogProps = {
  organisationId: string;
  trigger?: React.ReactNode;
};

const ZAdminOrganisationSyncSubscriptionFormSchema = z.object({
  syncClaims: z.boolean(),
});

type TAdminOrganisationSyncSubscriptionFormSchema = z.infer<typeof ZAdminOrganisationSyncSubscriptionFormSchema>;

export const AdminOrganisationSyncSubscriptionDialog = ({
  organisationId,
  trigger,
}: AdminOrganisationSyncSubscriptionDialogProps) => {
  const [open, setOpen] = useState(false);

  const { t } = useLingui();
  const { toast } = useToast();

  const navigate = useNavigate();

  const form = useForm<TAdminOrganisationSyncSubscriptionFormSchema>({
    resolver: zodResolver(ZAdminOrganisationSyncSubscriptionFormSchema),
    defaultValues: {
      syncClaims: false,
    },
  });

  const { mutateAsync: syncSubscription } = trpc.admin.organisation.subscription.sync.useMutation();

  const onFormSubmit = async (values: TAdminOrganisationSyncSubscriptionFormSchema) => {
    try {
      await syncSubscription({
        organisationId,
        syncClaims: values.syncClaims,
      });

      toast({
        title: t`Subscription synced`,
        description: t`The organisation subscription has been synced with Stripe.`,
        duration: 5000,
      });

      await navigate(0);

      setOpen(false);
    } catch (err) {
      const error = AppError.parseError(err);

      console.error(error);

      toast({
        title: t`Failed to sync subscription`,
        description: error.message,
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
          <Button variant="outline">
            <Trans>Sync Stripe subscription</Trans>
          </Button>
        )}
      </DialogTrigger>

      <DialogContent position="center">
        <DialogHeader>
          <DialogTitle>
            <Trans>Sync Stripe subscription</Trans>
          </DialogTitle>

          <DialogDescription>
            <Trans>Fetch the latest subscription data from Stripe and apply it to this organisation.</Trans>
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onFormSubmit)}>
            <fieldset className="flex h-full flex-col space-y-4" disabled={form.formState.isSubmitting}>
              <FormField
                control={form.control}
                name="syncClaims"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        id="admin-sync-subscription-sync-claims"
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>

                    <label
                      htmlFor="admin-sync-subscription-sync-claims"
                      className="font-normal text-muted-foreground text-sm leading-snug"
                    >
                      <Trans>
                        Sync claims. This will overwrite the current claim with the one resolved from the Stripe
                        subscription.
                      </Trans>
                    </label>
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                  <Trans>Cancel</Trans>
                </Button>

                <Button type="submit" loading={form.formState.isSubmitting}>
                  <Trans>Sync</Trans>
                </Button>
              </DialogFooter>
            </fieldset>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
