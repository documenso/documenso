import { useEffect, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useLingui } from '@lingui/react/macro';
import { Trans } from '@lingui/react/macro';
import type * as DialogPrimitive from '@radix-ui/react-dialog';
import { AlertCircleIcon, CheckCircleIcon, ClockIcon, CopyIcon, Loader2Icon } from 'lucide-react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';

import { useCopyToClipboard } from '@documenso/lib/client-only/hooks/use-copy-to-clipboard';
import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { AppError } from '@documenso/lib/errors/app-error';
import { trpc } from '@documenso/trpc/react';
import { ZCreateOrganisationEmailRequestSchema } from '@documenso/trpc/server/organisation-router/create-organisation-email-domain.types';
import { CopyTextButton } from '@documenso/ui/components/common/copy-text-button';
import { Alert, AlertDescription } from '@documenso/ui/primitives/alert';
import { Badge } from '@documenso/ui/primitives/badge';
import { Button } from '@documenso/ui/primitives/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@documenso/ui/primitives/card';
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
import { Separator } from '@documenso/ui/primitives/separator';
import { useToast } from '@documenso/ui/primitives/use-toast';

export type OrganisationEmailCreateDialogProps = {
  trigger?: React.ReactNode;
} & Omit<DialogPrimitive.DialogProps, 'children'>;

const ZCreateOrganisationEmailFormSchema = ZCreateOrganisationEmailRequestSchema.pick({
  domain: true,
});

type TCreateOrganisationEmailFormSchema = z.infer<typeof ZCreateOrganisationEmailFormSchema>;

type DomainRecord = {
  name: string;
  value: string;
  type: string;
};

type VerificationStatus = {
  status: 'pending' | 'verified' | 'failed';
  records: DomainRecord[];
  lastChecked?: string;
};

export const OrganisationEmailCreateDialog = ({
  trigger,
  ...props
}: OrganisationEmailCreateDialogProps) => {
  const { t } = useLingui();
  const { toast } = useToast();
  const organisation = useCurrentOrganisation();

  const [, copy] = useCopyToClipboard();

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'domain' | 'verification'>('domain');
  const [verification, setVerification] = useState<VerificationStatus | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  const form = useForm({
    resolver: zodResolver(ZCreateOrganisationEmailFormSchema),
    defaultValues: {
      domain: '',
    },
  });

  const { mutateAsync: createOrganisationEmail } = trpc.organisation.email.create.useMutation();

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      form.reset();
      setVerification(null);
      setIsPolling(false);
      setStep('domain');
    }
  }, [open, form]);

  // Polling effect for verification status
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isPolling && verification?.status === 'pending') {
      interval = setInterval(async () => {
        try {
          // Mock verification check - replace with actual API call
          const mockVerification = {
            status: Math.random() > 0.5 ? 'verified' : ('pending' as const),
            records: verification.records,
            lastChecked: new Date().toISOString(),
          };

          setVerification(mockVerification);

          if (mockVerification.status === 'verified') {
            setIsPolling(false);
            toast({
              title: t`Domain Verified!`,
              description: t`Your domain has been successfully verified and is ready for sending emails.`,
            });
          }
        } catch (error) {
          console.error('Polling error:', error);
        }
      }, 10000); // Poll every 10 seconds
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPolling, verification?.status, toast, t]);

  const onFormSubmit = async ({ domain }: TCreateOrganisationEmailFormSchema) => {
    try {
      const { emailDomain, records } = await createOrganisationEmail({
        domain,
        organisationId: organisation.id,
      });

      setVerification({
        status: 'pending',
        records,
        lastChecked: new Date().toISOString(),
      });

      setStep('verification');
      setIsPolling(true);

      toast({
        title: t`Domain Added`,
        description: t`DKIM records generated. Please add the DNS records to verify your domain.`,
      });
    } catch (err) {
      const error = AppError.parseError(err);
      console.error(error);

      toast({
        title: t`An unknown error occurred`,
        description: t`We encountered an unknown error while attempting to add your domain. Please try again later.`,
        variant: 'destructive',
      });
    }
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await copy(text);

      toast({
        title: t`Copied!`,
        description: t`${label} copied to clipboard.`,
      });
    } catch (error) {
      toast({
        title: t`Copy Failed`,
        description: t`Please copy the text manually.`,
        variant: 'destructive',
      });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'verified':
        return <CheckCircleIcon className="h-4 w-4" />;
      case 'failed':
        return <AlertCircleIcon className="h-4 w-4" />;
      default:
        return <ClockIcon className="h-4 w-4" />;
    }
  };

  const getStatusVariant = (status: string): 'default' | 'secondary' | 'destructive' => {
    switch (status) {
      case 'verified':
        return 'default';
      case 'failed':
        return 'destructive';
      default:
        return 'secondary';
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
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">{form.getValues('domain')}</h3>
                  <p className="text-muted-foreground text-sm">
                    <Trans>Domain verification status</Trans>
                  </p>
                </div>
                <Badge
                  variant={getStatusVariant(verification?.status ?? 'pending')}
                  className="gap-1"
                >
                  {getStatusIcon(verification?.status ?? 'pending')}
                  {verification?.status.charAt(0).toUpperCase() + verification?.status.slice(1)}
                </Badge>
              </div>

              <Separator />

              <div className="space-y-4">
                <div>
                  <h4 className="mb-2 font-medium">
                    <Trans>DNS Records to Add</Trans>
                  </h4>
                  <p className="text-muted-foreground mb-4 text-sm">
                    <Trans>
                      Add these TXT records to your DNS provider to verify domain ownership and
                      enable DKIM signing.
                    </Trans>
                  </p>
                </div>

                {verification?.records.map((record, index) => (
                  <Card key={index}>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">
                        {record.type} <Trans>Record</Trans> {index + 1}
                      </CardTitle>
                      <CardDescription>
                        <Trans>Add this record to your DNS provider</Trans>
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="space-y-2">
                        <label className="text-muted-foreground text-xs font-medium">
                          <Trans>RECORD NAME</Trans>
                        </label>
                        <div className="flex items-center gap-2">
                          <code className="bg-muted flex-1 break-all rounded p-2 font-mono text-sm">
                            {record.name}
                          </code>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={async () => copyToClipboard(record.name, t`Record name`)}
                          >
                            <CopyIcon className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-muted-foreground text-xs font-medium">
                          <Trans>RECORD VALUE</Trans>
                        </label>
                        <div className="flex items-center gap-2">
                          <code className="bg-muted flex-1 break-all rounded p-2 font-mono text-sm">
                            {record.value}
                          </code>
                          <CopyTextButton
                            value={record.value}
                            onCopySuccess={() => toast({ title: t`Value copied to clipboard` })}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {verification?.status === 'pending' && (
                <Alert>
                  <ClockIcon className="h-4 w-4" />
                  <AlertDescription>
                    {isPolling && <Loader2Icon className="mr-2 inline h-4 w-4 animate-spin" />}
                    <Trans>
                      Verification in progress. This may take a few minutes after you add the DNS
                      records.
                    </Trans>
                    {verification.lastChecked && (
                      <span className="text-muted-foreground mt-1 block text-xs">
                        <Trans>Last checked:</Trans>{' '}
                        {new Date(verification.lastChecked).toLocaleTimeString()}
                      </span>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              {verification?.status === 'verified' && (
                <Alert>
                  <CheckCircleIcon className="h-4 w-4" />
                  <AlertDescription>
                    <Trans>
                      Domain successfully verified! You can now send emails using this domain.
                    </Trans>
                  </AlertDescription>
                </Alert>
              )}

              {verification?.status === 'failed' && (
                <Alert variant="destructive">
                  <AlertCircleIcon className="h-4 w-4" />
                  <AlertDescription>
                    <Trans>
                      Domain verification failed. Please check that you've added the DNS records
                      correctly and try again.
                    </Trans>
                  </AlertDescription>
                </Alert>
              )}

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setOpen(false)}
                  disabled={verification?.status === 'pending' && isPolling}
                >
                  {verification?.status === 'verified' ? t`Done` : t`Close`}
                </Button>
                {verification?.status === 'pending' && (
                  <Button
                    onClick={async () => {
                      try {
                        // Mock verification check - replace with actual API call
                        const mockVerification = {
                          status: Math.random() > 0.5 ? 'verified' : ('pending' as const),
                          records: verification.records,
                          lastChecked: new Date().toISOString(),
                        };

                        setVerification(mockVerification);
                      } catch (error) {
                        toast({
                          title: t`Check Failed`,
                          description: t`Failed to check verification status.`,
                          variant: 'destructive',
                        });
                      }
                    }}
                  >
                    <Trans>Check Now</Trans>
                  </Button>
                )}
              </DialogFooter>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
