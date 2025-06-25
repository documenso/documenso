import { useEffect, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useLingui } from '@lingui/react/macro';
import { Trans } from '@lingui/react/macro';
import type * as DialogPrimitive from '@radix-ui/react-dialog';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';

import { useCopyToClipboard } from '@documenso/lib/client-only/hooks/use-copy-to-clipboard';
import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { trpc } from '@documenso/trpc/react';
import { ZCreateOrganisationEmailDomainRequestSchema } from '@documenso/trpc/server/organisation-router/create-organisation-email-domain.types';
import { CopyTextButton } from '@documenso/ui/components/common/copy-text-button';
import { Alert, AlertDescription } from '@documenso/ui/primitives/alert';
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

  const [, copy] = useCopyToClipboard();

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
    trpc.organisation.emailDomain.create.useMutation();

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      form.reset();
      setStep('domain');
    }

    setStep('verification');
    setRecordsToAdd([
      {
        type: 'TXT',
        name: 'documenso-org-vulexdrtyrukywih._domainkey.taipu.app',
        value:
          'v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAxhd6B32Bu9Aqatp5PX5wboZnv1k0yyMam3RxZFzQUPj20ezL7FCKQtFkxHYh+Yl6mUyGEv+jS7t+qFRL9xZrITRGXWJ8Ub92tRoIQWZKSciLG1WATBwIxhHcp/j/F9Yb7/8JFN1+bqmzABBBShxV3FERwAXQtCj8T0YcbdRO98PdbiLWDNWCG9NJBhAupUdaD5Iou7CN/yrNsu8XAR+8+ZAXwJWcMu+uJZoDyuQzNsd9oGzSLZ2LHp+DDK74tMIh9cq4+xfhU/1gCskft+AS94QvbTP/nPqemz+usAeBbQsPb2cWrJIMB/kEtqNioFizSbCKhN7Y4ID1zIRIOibHiQIDAQAB',
      },
    ]);
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

      <DialogContent position="center" className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        {step === 'domain' ? (
          <>
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
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>
                <Trans>Verify Domain</Trans>
              </DialogTitle>
              <DialogDescription>
                <Trans>Add these DNS records to verify your domain ownership</Trans>
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              <div className="space-y-4">
                {recordsToAdd.map((record) => (
                  <div className="space-y-4 rounded border p-4 text-sm" key={record.name}>
                    <div className="space-y-2">
                      <label className="text-muted-foreground font-medium">
                        <Trans>Record Type</Trans>
                      </label>
                      <div className="flex items-center gap-2">
                        <code className="bg-muted flex-1 break-all rounded p-2.5 font-mono">
                          {record.type}
                        </code>
                        <CopyTextButton
                          value={record.type}
                          onCopySuccess={() => toast({ title: t`Copied to clipboard` })}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-muted-foreground font-medium">
                        <Trans>Record Name</Trans>
                      </label>
                      <div className="flex items-center gap-2">
                        <code className="bg-muted flex-1 break-all rounded p-2.5 font-mono">
                          {record.name}
                        </code>
                        <CopyTextButton
                          value={record.name}
                          onCopySuccess={() => toast({ title: t`Copied to clipboard` })}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-muted-foreground font-medium">
                        <Trans>Record Value</Trans>
                      </label>
                      <div className="flex items-center gap-2">
                        <code className="bg-muted flex-1 break-all rounded p-2.5 font-mono">
                          {record.value}
                        </code>
                        <CopyTextButton
                          value={record.value}
                          onCopySuccess={() => toast({ title: t`Copied to clipboard` })}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <Alert variant="neutral">
                <AlertDescription>
                  <Trans>
                    Once you update your DNS records, it may take up to 48 hours for it to be
                    propogated. Once the DNS propagation is complete you will need to come back and
                    press the "Sync" domains button
                  </Trans>
                </AlertDescription>
              </Alert>

              <DialogFooter>
                <Button variant="secondary" onClick={() => setOpen(false)}>
                  <Trans>Close</Trans>
                </Button>
              </DialogFooter>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
