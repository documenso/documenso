import { useEffect, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useLingui } from '@lingui/react/macro';
import { Trans } from '@lingui/react/macro';
import type * as DialogPrimitive from '@radix-ui/react-dialog';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';

import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { trpc } from '@documenso/trpc/react';
import { ZCreateOrganisationEmailDomainRequestSchema } from '@documenso/trpc/server/enterprise-router/create-organisation-email-domain.types';
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@documenso/ui/primitives/form/form';
import { Input } from '@documenso/ui/primitives/input';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { OrganisationEmailDomainRecordContent } from './organisation-email-domain-records-dialog';

export type OrganisationEmailCreateDialogProps = {
  trigger?: React.ReactNode;
} & Omit<DialogPrimitive.DialogProps, 'children'>;

const ZCreateOrganisationEmailDomainFormSchema = ZCreateOrganisationEmailDomainRequestSchema.pick({
  domain: true,
});

type TCreateOrganisationEmailDomainFormSchema = z.infer<
  typeof ZCreateOrganisationEmailDomainFormSchema
>;

type DomainRecord = {
  name: string;
  value: string;
  type: string;
};

export const OrganisationEmailDomainCreateDialog = ({
  trigger,
  ...props
}: OrganisationEmailCreateDialogProps) => {
  const { t } = useLingui();
  const { toast } = useToast();
  const organisation = useCurrentOrganisation();

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'domain' | 'verification'>('domain');
  const [recordsToAdd, setRecordsToAdd] = useState<DomainRecord[]>([]);

  const form = useForm({
    resolver: zodResolver(ZCreateOrganisationEmailDomainFormSchema),
    defaultValues: {
      domain: '',
    },
  });

  const { mutateAsync: createOrganisationEmail } =
    trpc.enterprise.organisation.emailDomain.create.useMutation();

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      form.reset();
      setStep('domain');
    }
  }, [open, form]);

  const onFormSubmit = async ({ domain }: TCreateOrganisationEmailDomainFormSchema) => {
    try {
      const { records } = await createOrganisationEmail({
        domain,
        organisationId: organisation.id,
      });

      setRecordsToAdd(records);
      setStep('verification');

      toast({
        title: t`Domain Added`,
        description: t`DKIM records generated. Please add the DNS records to verify your domain.`,
      });
    } catch (err) {
      const error = AppError.parseError(err);
      console.error(error);

      if (error.code === AppErrorCode.ALREADY_EXISTS) {
        toast({
          title: t`Domain already in use`,
          description: t`Please try a different domain.`,
          variant: 'destructive',
          duration: 10000,
        });
      } else {
        toast({
          title: t`An unknown error occurred`,
          description: t`We encountered an unknown error while attempting to add your domain. Please try again later.`,
          variant: 'destructive',
        });
      }
    }
  };

  return (
    <Dialog
      {...props}
      open={open}
      onOpenChange={(value) => !form.formState.isSubmitting && setOpen(value)}
    >
      <DialogTrigger onClick={(e) => e.stopPropagation()} asChild={true}>
        {trigger ?? (
          <Button className="flex-shrink-0" variant="secondary">
            <Trans>Add Email Domain</Trans>
          </Button>
        )}
      </DialogTrigger>

      {step === 'domain' ? (
        <DialogContent position="center" className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              <Trans>Add Custom Email Domain</Trans>
            </DialogTitle>
            <DialogDescription>
              <Trans>
                Add a custom domain to send emails on behalf of your organisation. We'll generate
                DKIM records that you need to add to your DNS provider.
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
                  name="domain"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel required>
                        <Trans>Domain Name</Trans>
                      </FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="example.com" className="bg-background" />
                      </FormControl>
                      <FormMessage />
                      <FormDescription>
                        <Trans>
                          Enter the domain you want to use for sending emails (without http:// or
                          www)
                        </Trans>
                      </FormDescription>
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                    <Trans>Cancel</Trans>
                  </Button>

                  <Button
                    type="submit"
                    data-testid="dialog-create-organisation-email-button"
                    loading={form.formState.isSubmitting}
                  >
                    <Trans>Generate DKIM Records</Trans>
                  </Button>
                </DialogFooter>
              </fieldset>
            </form>
          </Form>
        </DialogContent>
      ) : (
        <OrganisationEmailDomainRecordContent records={recordsToAdd} />
      )}
    </Dialog>
  );
};
