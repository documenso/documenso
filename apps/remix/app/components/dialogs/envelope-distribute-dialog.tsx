import { useMemo, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useLingui } from '@lingui/react/macro';
import { Trans } from '@lingui/react/macro';
import {
  DocumentDistributionMethod,
  DocumentStatus,
  EnvelopeType,
  type Field,
  FieldType,
  type Recipient,
  RecipientRole,
} from '@prisma/client';
import { AnimatePresence, motion } from 'framer-motion';
import { InfoIcon } from 'lucide-react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { RECIPIENT_ROLES_DESCRIPTION } from '@documenso/lib/constants/recipient-roles';
import type { TEnvelope } from '@documenso/lib/types/envelope';
import { formatSigningLink } from '@documenso/lib/utils/recipients';
import { trpc, trpc as trpcReact } from '@documenso/trpc/react';
import { CopyTextButton } from '@documenso/ui/components/common/copy-text-button';
import { DocumentSendEmailMessageHelper } from '@documenso/ui/components/document/document-send-email-message-helper';
import { Alert, AlertDescription } from '@documenso/ui/primitives/alert';
import { AvatarWithText } from '@documenso/ui/primitives/avatar';
import { Button } from '@documenso/ui/primitives/button';
import {
  Dialog,
  DialogClose,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@documenso/ui/primitives/select';
import { Tabs, TabsList, TabsTrigger } from '@documenso/ui/primitives/tabs';
import { Textarea } from '@documenso/ui/primitives/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@documenso/ui/primitives/tooltip';
import { useToast } from '@documenso/ui/primitives/use-toast';

export type EnvelopeDistributeDialogProps = {
  envelope: Pick<TEnvelope, 'id' | 'userId' | 'teamId' | 'status' | 'type' | 'documentMeta'> & {
    recipients: Recipient[];
    fields: Field[];
  };
  trigger?: React.ReactNode;
};

export const ZEnvelopeDistributeFormSchema = z.object({
  meta: z.object({
    emailId: z.string().nullable(),
    emailReplyTo: z.preprocess(
      (val) => (val === '' ? undefined : val),
      z.string().email().optional(),
    ),
    subject: z.string(),
    message: z.string(),
    distributionMethod: z
      .nativeEnum(DocumentDistributionMethod)
      .optional()
      .default(DocumentDistributionMethod.EMAIL),
  }),
});

export type TEnvelopeDistributeFormSchema = z.infer<typeof ZEnvelopeDistributeFormSchema>;

export const EnvelopeDistributeDialog = ({ envelope, trigger }: EnvelopeDistributeDialogProps) => {
  const organisation = useCurrentOrganisation();

  const recipients = envelope.recipients;

  const { toast } = useToast();
  const { t } = useLingui();

  const [isOpen, setIsOpen] = useState(false);

  const { mutateAsync: distributeEnvelope } = trpcReact.envelope.distribute.useMutation();

  const form = useForm<TEnvelopeDistributeFormSchema>({
    defaultValues: {
      meta: {
        emailId: envelope.documentMeta?.emailId ?? null,
        emailReplyTo: envelope.documentMeta?.emailReplyTo || undefined,
        subject: envelope.documentMeta?.subject ?? '',
        message: envelope.documentMeta?.message ?? '',
        distributionMethod:
          envelope.documentMeta?.distributionMethod || DocumentDistributionMethod.EMAIL,
      },
    },
    resolver: zodResolver(ZEnvelopeDistributeFormSchema),
  });

  const {
    handleSubmit,
    setValue,
    watch,
    formState: { isSubmitting },
  } = form;

  const { data: emailData, isLoading: isLoadingEmails } =
    trpc.enterprise.organisation.email.find.useQuery({
      organisationId: organisation.id,
      perPage: 100,
    });

  const emails = emailData?.data || [];

  const distributionMethod = watch('meta.distributionMethod');

  const recipientsMissingSignatureFields = useMemo(
    () =>
      envelope.recipients.filter(
        (recipient) =>
          recipient.role === RecipientRole.SIGNER &&
          !envelope.fields.some(
            (field) => field.type === FieldType.SIGNATURE && field.recipientId === recipient.id,
          ),
      ),
    [envelope.recipients, envelope.fields],
  );

  const onFormSubmit = async ({ meta }: TEnvelopeDistributeFormSchema) => {
    try {
      await distributeEnvelope({ envelopeId: envelope.id, meta });

      toast({
        title: t`Envelope distributed`,
        description: t`Your envelope has been distributed successfully.`,
        duration: 5000,
      });

      setIsOpen(false);
    } catch (err) {
      toast({
        title: t`Something went wrong`,
        description: t`This envelope could not be distributed at this time. Please try again.`,
        variant: 'destructive',
        duration: 7500,
      });
    }
  };

  if (envelope.status !== DocumentStatus.DRAFT || envelope.type !== EnvelopeType.DOCUMENT) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>

      <DialogContent className="max-w-md" hideClose>
        <DialogHeader>
          <DialogTitle>
            <Trans>Send Document</Trans>
          </DialogTitle>

          <DialogDescription>
            <Trans>Recipients will be able to sign the document once sent</Trans>
          </DialogDescription>
        </DialogHeader>
        {recipientsMissingSignatureFields.length === 0 ? (
          <Form {...form}>
            <form onSubmit={handleSubmit(onFormSubmit)}>
              <fieldset disabled={isSubmitting}>
                <Tabs
                  onValueChange={(value) =>
                    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
                    setValue('meta.distributionMethod', value as DocumentDistributionMethod)
                  }
                  value={distributionMethod}
                  className="mb-2"
                >
                  <TabsList className="w-full">
                    <TabsTrigger className="w-full" value={DocumentDistributionMethod.EMAIL}>
                      Email
                    </TabsTrigger>
                    <TabsTrigger className="w-full" value={DocumentDistributionMethod.NONE}>
                      None
                    </TabsTrigger>
                  </TabsList>
                </Tabs>

                <div className="min-h-72">
                  <AnimatePresence initial={false} mode="wait">
                    {distributionMethod === DocumentDistributionMethod.EMAIL && (
                      <motion.div
                        key={'Emails'}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0, transition: { duration: 0.3 } }}
                        exit={{ opacity: 0, transition: { duration: 0.15 } }}
                      >
                        <Form {...form}>
                          <fieldset
                            className="mt-2 flex flex-col gap-y-4 rounded-lg"
                            disabled={form.formState.isSubmitting}
                          >
                            {organisation.organisationClaim.flags.emailDomains && (
                              <FormField
                                control={form.control}
                                name="meta.emailId"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>
                                      <Trans>Email Sender</Trans>
                                    </FormLabel>
                                    <FormControl>
                                      <Select
                                        {...field}
                                        value={field.value === null ? '-1' : field.value}
                                        onValueChange={(value) =>
                                          field.onChange(value === '-1' ? null : value)
                                        }
                                      >
                                        <SelectTrigger
                                          loading={isLoadingEmails}
                                          className="bg-background"
                                        >
                                          <SelectValue />
                                        </SelectTrigger>

                                        <SelectContent>
                                          {emails.map((email) => (
                                            <SelectItem key={email.id} value={email.id}>
                                              {email.email}
                                            </SelectItem>
                                          ))}

                                          <SelectItem value={'-1'}>Documenso</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </FormControl>

                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            )}

                            <FormField
                              control={form.control}
                              name="meta.emailReplyTo"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>
                                    <Trans>Reply To Email</Trans>{' '}
                                    <span className="text-muted-foreground">(Optional)</span>
                                  </FormLabel>

                                  <FormControl>
                                    <Input {...field} maxLength={254} />
                                  </FormControl>

                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name="meta.subject"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>
                                    <Trans>Subject</Trans>{' '}
                                    <span className="text-muted-foreground">(Optional)</span>
                                  </FormLabel>

                                  <FormControl>
                                    <Input {...field} maxLength={255} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name="meta.message"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="flex flex-row items-center">
                                    <Trans>Message</Trans>{' '}
                                    <span className="text-muted-foreground">(Optional)</span>
                                    <Tooltip>
                                      <TooltipTrigger>
                                        <InfoIcon className="mx-2 h-4 w-4" />
                                      </TooltipTrigger>
                                      <TooltipContent className="text-muted-foreground p-4">
                                        <DocumentSendEmailMessageHelper />
                                      </TooltipContent>
                                    </Tooltip>
                                  </FormLabel>

                                  <FormControl>
                                    <Textarea
                                      className="bg-background mt-2 h-16 resize-none"
                                      {...field}
                                      maxLength={5000}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </fieldset>
                        </Form>
                      </motion.div>
                    )}

                    {distributionMethod === DocumentDistributionMethod.NONE && (
                      <motion.div
                        key={'Links'}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0, transition: { duration: 0.3 } }}
                        exit={{ opacity: 0, transition: { duration: 0.15 } }}
                        className="min-h-60 rounded-lg border"
                      >
                        {envelope.status === DocumentStatus.DRAFT ? (
                          <div className="text-muted-foreground py-24 text-center text-sm">
                            <p>
                              <Trans>We won't send anything to notify recipients.</Trans>
                            </p>

                            <p className="mt-2">
                              <Trans>
                                We will generate signing links for you, which you can send to the
                                recipients through your method of choice.
                              </Trans>
                            </p>
                          </div>
                        ) : (
                          <ul className="text-muted-foreground divide-y">
                            {/* Todo: Envelopes - I don't think this section shows up */}

                            {recipients.length === 0 && (
                              <li className="flex flex-col items-center justify-center py-6 text-sm">
                                <Trans>No recipients</Trans>
                              </li>
                            )}

                            {recipients.map((recipient) => (
                              <li
                                key={recipient.id}
                                className="flex items-center justify-between px-4 py-3 text-sm"
                              >
                                <AvatarWithText
                                  avatarFallback={recipient.email.slice(0, 1).toUpperCase()}
                                  primaryText={
                                    <p className="text-muted-foreground text-sm">
                                      {recipient.email}
                                    </p>
                                  }
                                  secondaryText={
                                    <p className="text-muted-foreground/70 text-xs">
                                      {t(RECIPIENT_ROLES_DESCRIPTION[recipient.role].roleName)}
                                    </p>
                                  }
                                />

                                {recipient.role !== RecipientRole.CC && (
                                  <CopyTextButton
                                    value={formatSigningLink(recipient.token)}
                                    onCopySuccess={() => {
                                      toast({
                                        title: t`Copied to clipboard`,
                                        description: t`The signing link has been copied to your clipboard.`,
                                      });
                                    }}
                                    badgeContentUncopied={
                                      <p className="ml-1 text-xs">
                                        <Trans>Copy</Trans>
                                      </p>
                                    }
                                    badgeContentCopied={
                                      <p className="ml-1 text-xs">
                                        <Trans>Copied</Trans>
                                      </p>
                                    }
                                  />
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <DialogFooter>
                  <DialogClose asChild>
                    <Button type="button" variant="secondary" disabled={isSubmitting}>
                      <Trans>Cancel</Trans>
                    </Button>
                  </DialogClose>

                  <Button loading={isSubmitting} type="submit">
                    {distributionMethod === DocumentDistributionMethod.EMAIL ? (
                      <Trans>Send</Trans>
                    ) : (
                      <Trans>Generate Links</Trans>
                    )}
                  </Button>
                </DialogFooter>
              </fieldset>
            </form>
          </Form>
        ) : (
          <>
            <Alert variant="warning">
              <AlertDescription>
                <Trans>The following signers are missing signature fields:</Trans>

                <ul className="ml-2 mt-1 list-inside list-disc">
                  {recipientsMissingSignatureFields.map((recipient) => (
                    <li key={recipient.id}>{recipient.email}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>

            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="secondary">
                  <Trans>Close</Trans>
                </Button>
              </DialogClose>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
