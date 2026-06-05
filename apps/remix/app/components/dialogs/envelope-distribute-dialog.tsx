import { useEffect, useMemo, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useLingui } from '@lingui/react/macro';
import { Trans } from '@lingui/react/macro';
import { DocumentDistributionMethod, DocumentStatus, EnvelopeType } from '@prisma/client';
import { AnimatePresence, motion } from 'framer-motion';
import { CalendarClock, InfoIcon } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { match } from 'ts-pattern';
import * as z from 'zod';

import { useCurrentEnvelopeEditor } from '@documenso/lib/client-only/providers/envelope-editor-provider';
import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { DO_NOT_INVALIDATE_QUERY_ON_MUTATION } from '@documenso/lib/constants/trpc';
import { extractDocumentAuthMethods } from '@documenso/lib/utils/document-auth';
import { getRecipientsWithMissingFields } from '@documenso/lib/utils/recipients';
import { zEmail } from '@documenso/lib/utils/zod';
import { trpc, trpc as trpcReact } from '@documenso/trpc/react';
import { DocumentSendEmailMessageHelper } from '@documenso/ui/components/document/document-send-email-message-helper';
import { cn } from '@documenso/ui/lib/utils';
import { Alert, AlertDescription } from '@documenso/ui/primitives/alert';
import { Button } from '@documenso/ui/primitives/button';
import { Checkbox } from '@documenso/ui/primitives/checkbox';
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
import { SpinnerBox } from '@documenso/ui/primitives/spinner';
import { Tabs, TabsList, TabsTrigger } from '@documenso/ui/primitives/tabs';
import { Textarea } from '@documenso/ui/primitives/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@documenso/ui/primitives/tooltip';
import { useToast } from '@documenso/ui/primitives/use-toast';

export type EnvelopeDistributeDialogProps = {
  onDistribute?: () => Promise<void>;
  documentRootPath: string;
  trigger?: React.ReactNode;
};

export const ZEnvelopeDistributeFormSchema = z.object({
  meta: z.object({
    emailId: z.string().nullable(),
    emailReplyTo: z.preprocess((val) => (val === '' ? undefined : val), zEmail().optional()),
    subject: z.string(),
    message: z.string(),
    distributionMethod: z
      .nativeEnum(DocumentDistributionMethod)
      .optional()
      .default(DocumentDistributionMethod.EMAIL),
  }),
});

export type TEnvelopeDistributeFormSchema = z.infer<typeof ZEnvelopeDistributeFormSchema>;

/**
 * Format a Date as a value accepted by an `<input type="datetime-local">`
 * (`YYYY-MM-DDTHH:mm`) in the user's local timezone.
 */
const toDateTimeLocalValue = (date: Date): string => {
  const pad = (value: number) => String(value).padStart(2, '0');

  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
};

export const EnvelopeDistributeDialog = ({
  trigger,
  documentRootPath,
  onDistribute,
}: EnvelopeDistributeDialogProps) => {
  const organisation = useCurrentOrganisation();

  const { envelope, syncEnvelope, isAutosaving, autosaveError } = useCurrentEnvelopeEditor();

  const { toast } = useToast();
  const { t } = useLingui();
  const navigate = useNavigate();

  const [isOpen, setIsOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const [isScheduled, setIsScheduled] = useState(Boolean(envelope.scheduledAt));
  const [scheduledAtLocal, setScheduledAtLocal] = useState(
    envelope.scheduledAt ? toDateTimeLocalValue(new Date(envelope.scheduledAt)) : '',
  );
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [isCancellingSchedule, setIsCancellingSchedule] = useState(false);

  const { mutateAsync: distributeEnvelope } = trpcReact.envelope.distribute.useMutation();
  const { mutateAsync: cancelScheduledSend } =
    trpcReact.envelope.cancelScheduledSend.useMutation();

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
    trpc.enterprise.organisation.email.find.useQuery(
      {
        organisationId: organisation.id,
        perPage: 100,
      },
      {
        ...DO_NOT_INVALIDATE_QUERY_ON_MUTATION,
      },
    );

  const emails = emailData?.data || [];

  const distributionMethod = watch('meta.distributionMethod');

  const recipientsWithIndex = useMemo(
    () =>
      envelope.recipients.map((recipient, index) => ({
        ...recipient,
        index,
      })),
    [envelope.recipients],
  );

  const recipientsMissingSignatureFields = useMemo(
    () => getRecipientsWithMissingFields(recipientsWithIndex, envelope.fields),
    [recipientsWithIndex, envelope.fields],
  );

  /**
   * List of recipients who must have an email due to having auth enabled.
   */
  const recipientsMissingRequiredEmail = useMemo(() => {
    return recipientsWithIndex.filter((recipient) => {
      const auth = extractDocumentAuthMethods({
        documentAuth: envelope.authOptions,
        recipientAuth: recipient.authOptions,
      });

      return (
        (auth.recipientAccessAuthRequired || auth.recipientActionAuthRequired) && !recipient.email
      );
    });
  }, [recipientsWithIndex, envelope.authOptions]);

  const invalidEnvelopeCode = useMemo(() => {
    if (recipientsMissingSignatureFields.length > 0) {
      return 'MISSING_SIGNATURES';
    }

    if (envelope.recipients.length === 0) {
      return 'MISSING_RECIPIENTS';
    }

    if (recipientsMissingRequiredEmail.length > 0) {
      return 'MISSING_REQUIRED_EMAIL';
    }

    return null;
  }, [envelope.recipients, recipientsMissingRequiredEmail, recipientsMissingSignatureFields]);

  // Scheduling is only offered for email distribution — "None" just generates links immediately.
  const canSchedule = distributionMethod === DocumentDistributionMethod.EMAIL;

  const onFormSubmit = async ({ meta }: TEnvelopeDistributeFormSchema) => {
    let scheduledAt: string | undefined;

    if (canSchedule && isScheduled) {
      if (!scheduledAtLocal) {
        setScheduleError(t`Please choose a date and time to send.`);
        return;
      }

      const scheduledDate = new Date(scheduledAtLocal);

      if (Number.isNaN(scheduledDate.getTime())) {
        setScheduleError(t`Please choose a valid date and time.`);
        return;
      }

      if (scheduledDate.getTime() <= Date.now()) {
        setScheduleError(t`The scheduled time must be in the future.`);
        return;
      }

      setScheduleError(null);
      scheduledAt = scheduledDate.toISOString();
    }

    try {
      await distributeEnvelope({ envelopeId: envelope.id, scheduledAt, meta });

      await onDistribute?.();

      if (scheduledAt) {
        toast({
          title: t`Envelope scheduled`,
          description: t`Your envelope will be sent automatically at the scheduled time.`,
          duration: 5000,
        });

        setIsOpen(false);

        await navigate(`${documentRootPath}/${envelope.id}`);

        return;
      }

      let redirectPath = `${documentRootPath}/${envelope.id}`;

      if (meta.distributionMethod === DocumentDistributionMethod.NONE) {
        redirectPath += '?action=copy-links';
      }

      await navigate(redirectPath);

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

  const onCancelSchedule = async () => {
    setIsCancellingSchedule(true);

    try {
      await cancelScheduledSend({ envelopeId: envelope.id });

      setIsScheduled(false);
      setScheduledAtLocal('');
      setScheduleError(null);

      toast({
        title: t`Schedule cancelled`,
        description: t`This envelope is back to a draft and will not be sent automatically.`,
        duration: 5000,
      });

      setIsOpen(false);

      await navigate(`${documentRootPath}/${envelope.id}`);
    } catch (err) {
      toast({
        title: t`Something went wrong`,
        description: t`The scheduled send could not be cancelled at this time. Please try again.`,
        variant: 'destructive',
        duration: 7500,
      });
    } finally {
      setIsCancellingSchedule(false);
    }
  };

  const handleSync = async () => {
    if (isSyncing) {
      return;
    }

    setIsSyncing(true);

    try {
      await syncEnvelope();
    } catch (err) {
      console.error(err);
    }

    setIsSyncing(false);
  };

  useEffect(() => {
    // Resync the whole envelope if the envelope is mid saving.
    if (isOpen && (isAutosaving || autosaveError)) {
      void handleSync();
    }
  }, [isOpen]);

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

        {!invalidEnvelopeCode || isSyncing ? (
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
                      <Trans>Email</Trans>
                    </TabsTrigger>
                    <TabsTrigger className="w-full" value={DocumentDistributionMethod.NONE}>
                      <Trans>None</Trans>
                    </TabsTrigger>
                  </TabsList>
                </Tabs>

                <div
                  className={cn('min-h-72', {
                    'min-h-[23rem]': organisation.organisationClaim.flags.emailDomains,
                  })}
                >
                  <AnimatePresence initial={false} mode="wait">
                    {isSyncing ? (
                      <motion.div
                        key={'Flushing'}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0, transition: { duration: 0.3 } }}
                        exit={{ opacity: 0, transition: { duration: 0.15 } }}
                      >
                        <SpinnerBox spinnerProps={{ size: 'sm' }} className="h-72" />
                      </motion.div>
                    ) : distributionMethod === DocumentDistributionMethod.EMAIL ? (
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

                                          <SelectItem value={'-1'}>PSD Document Signing</SelectItem>
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
                                    <Trans>
                                      Reply To Email{' '}
                                      <span className="text-muted-foreground">(Optional)</span>
                                    </Trans>
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
                                    <Trans>
                                      Subject{' '}
                                      <span className="text-muted-foreground">(Optional)</span>
                                    </Trans>
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
                                    <Trans>
                                      Message{' '}
                                      <span className="text-muted-foreground">(Optional)</span>
                                    </Trans>
                                    <Tooltip>
                                      <TooltipTrigger type="button">
                                        <InfoIcon className="mx-2 h-4 w-4" />
                                      </TooltipTrigger>
                                      <TooltipContent className="p-4 text-muted-foreground">
                                        <DocumentSendEmailMessageHelper />
                                      </TooltipContent>
                                    </Tooltip>
                                  </FormLabel>

                                  <FormControl>
                                    <Textarea
                                      className="mt-2 h-16 resize-none bg-background"
                                      {...field}
                                      maxLength={5000}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <div className="flex flex-col gap-y-3 rounded-lg border p-3">
                              <label className="flex cursor-pointer items-center gap-x-2 text-sm font-medium">
                                <Checkbox
                                  checked={isScheduled}
                                  onCheckedChange={(checked) => {
                                    setIsScheduled(checked === true);
                                    setScheduleError(null);
                                  }}
                                />
                                <CalendarClock className="h-4 w-4 text-muted-foreground" />
                                <Trans>Schedule for later</Trans>
                              </label>

                              {isScheduled && (
                                <div className="flex flex-col gap-y-2">
                                  <Input
                                    type="datetime-local"
                                    className="bg-background"
                                    value={scheduledAtLocal}
                                    min={toDateTimeLocalValue(new Date())}
                                    onChange={(event) => {
                                      setScheduledAtLocal(event.target.value);
                                      setScheduleError(null);
                                    }}
                                  />

                                  <p className="text-xs text-muted-foreground">
                                    <Trans>
                                      The envelope will be sent automatically at this time, in your
                                      local timezone.
                                    </Trans>
                                  </p>

                                  {scheduleError && (
                                    <p className="text-xs text-destructive">{scheduleError}</p>
                                  )}
                                </div>
                              )}

                              {envelope.scheduledAt && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-auto self-start p-0 text-xs text-destructive hover:bg-transparent"
                                  loading={isCancellingSchedule}
                                  onClick={onCancelSchedule}
                                >
                                  <Trans>Cancel scheduled send</Trans>
                                </Button>
                              )}
                            </div>
                          </fieldset>
                        </Form>
                      </motion.div>
                    ) : distributionMethod === DocumentDistributionMethod.NONE ? (
                      <motion.div
                        key={'Links'}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0, transition: { duration: 0.3 } }}
                        exit={{ opacity: 0, transition: { duration: 0.15 } }}
                        className="min-h-60 rounded-lg border"
                      >
                        <div className="py-24 text-center text-sm text-muted-foreground">
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
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </div>

                <DialogFooter>
                  <DialogClose asChild>
                    <Button type="button" variant="secondary" disabled={isSubmitting}>
                      <Trans>Cancel</Trans>
                    </Button>
                  </DialogClose>

                  <Button loading={isSubmitting} disabled={isSyncing} type="submit">
                    {canSchedule && isScheduled ? (
                      <Trans>Schedule</Trans>
                    ) : distributionMethod === DocumentDistributionMethod.EMAIL ? (
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
              {match(invalidEnvelopeCode)
                .with('MISSING_RECIPIENTS', () => (
                  <AlertDescription>
                    <Trans>You need at least one recipient to send a document</Trans>
                  </AlertDescription>
                ))
                .with('MISSING_SIGNATURES', () => (
                  <AlertDescription>
                    <Trans>The following signers have no fields assigned:</Trans>

                    <ul className="ml-2 mt-1 list-inside list-disc">
                      {recipientsMissingSignatureFields.map((recipient) => (
                        <li key={recipient.id}>
                          {recipient.email || recipient.name || t`Recipient ${recipient.index + 1}`}
                        </li>
                      ))}
                    </ul>

                    <p className="mt-3">
                      <Trans>
                        Assign at least one field to each signer — a signature field if they need to
                        sign, or any other field type (e.g. Text) if they only need to fill in data.
                        If a recipient only needs to receive or view the document, change their role
                        to Viewer or CC instead.
                      </Trans>
                    </p>
                  </AlertDescription>
                ))
                .with('MISSING_REQUIRED_EMAIL', () => (
                  <AlertDescription>
                    <Trans>The following recipients require an email address:</Trans>

                    <ul className="ml-2 mt-1 list-inside list-disc">
                      {recipientsMissingRequiredEmail.map((recipient) => (
                        <li key={recipient.id}>
                          {recipient.email || recipient.name || t`Recipient ${recipient.index + 1}`}
                        </li>
                      ))}
                    </ul>
                  </AlertDescription>
                ))
                .exhaustive()}
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
