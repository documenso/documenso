import { useEffect } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import type { Field, Recipient } from '@prisma/client';
import { DocumentDistributionMethod, DocumentStatus, RecipientRole } from '@prisma/client';
import { AnimatePresence, motion } from 'framer-motion';
import { InfoIcon } from 'lucide-react';
import { useForm } from 'react-hook-form';

import { useAutoSave } from '@documenso/lib/client-only/hooks/use-autosave';
import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { RECIPIENT_ROLES_DESCRIPTION } from '@documenso/lib/constants/recipient-roles';
import type { TDocument } from '@documenso/lib/types/document';
import { ZDocumentEmailSettingsSchema } from '@documenso/lib/types/document-email';
import { formatSigningLink } from '@documenso/lib/utils/recipients';
import { trpc } from '@documenso/trpc/react';
import { DocumentSendEmailMessageHelper } from '@documenso/ui/components/document/document-send-email-message-helper';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@documenso/ui/primitives/form/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@documenso/ui/primitives/select';
import { Tabs, TabsList, TabsTrigger } from '@documenso/ui/primitives/tabs';

import { CopyTextButton } from '../../components/common/copy-text-button';
import { DocumentEmailCheckboxes } from '../../components/document/document-email-checkboxes';
import {
  DocumentReadOnlyFields,
  mapFieldsWithRecipients,
} from '../../components/document/document-read-only-fields';
import { AvatarWithText } from '../avatar';
import { Input } from '../input';
import { useStep } from '../stepper';
import { Textarea } from '../textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '../tooltip';
import { toast } from '../use-toast';
import { type TAddSubjectFormSchema, ZAddSubjectFormSchema } from './add-subject.types';
import {
  DocumentFlowFormContainerActions,
  DocumentFlowFormContainerContent,
  DocumentFlowFormContainerFooter,
  DocumentFlowFormContainerHeader,
  DocumentFlowFormContainerStep,
} from './document-flow-root';
import type { DocumentFlowStep } from './types';

export type AddSubjectFormProps = {
  documentFlow: DocumentFlowStep;
  recipients: Recipient[];
  fields: Field[];
  document: TDocument;
  onSubmit: (_data: TAddSubjectFormSchema) => void;
  onAutoSave: (_data: TAddSubjectFormSchema) => Promise<void>;
  isDocumentPdfLoaded: boolean;
};

export const AddSubjectFormPartial = ({
  documentFlow,
  recipients: recipients,
  fields: fields,
  document,
  onSubmit,
  onAutoSave,
  isDocumentPdfLoaded,
}: AddSubjectFormProps) => {
  const { _ } = useLingui();

  const organisation = useCurrentOrganisation();

  const form = useForm<TAddSubjectFormSchema>({
    defaultValues: {
      meta: {
        emailId: document.documentMeta?.emailId ?? null,
        emailReplyTo: document.documentMeta?.emailReplyTo || undefined,
        // emailReplyName: document.documentMeta?.emailReplyName || undefined,
        subject: document.documentMeta?.subject ?? '',
        message: document.documentMeta?.message ?? '',
        distributionMethod:
          document.documentMeta?.distributionMethod || DocumentDistributionMethod.EMAIL,
        emailSettings: ZDocumentEmailSettingsSchema.parse(document?.documentMeta?.emailSettings),
      },
    },
    resolver: zodResolver(ZAddSubjectFormSchema),
  });

  const {
    handleSubmit,
    setValue,
    watch,
    trigger,
    getValues,
    formState: { isSubmitting },
  } = form;

  const { data: emailData, isLoading: isLoadingEmails } =
    trpc.enterprise.organisation.email.find.useQuery({
      organisationId: organisation.id,
      perPage: 100,
    });

  const emails = emailData?.data || [];

  const GoNextLabel = {
    [DocumentDistributionMethod.EMAIL]: {
      [DocumentStatus.DRAFT]: msg`Send`,
      [DocumentStatus.PENDING]: recipients.some((recipient) => recipient.sendStatus === 'SENT')
        ? msg`Resend`
        : msg`Send`,
      [DocumentStatus.COMPLETED]: msg`Update`,
      [DocumentStatus.REJECTED]: msg`Update`,
    },
    [DocumentDistributionMethod.NONE]: {
      [DocumentStatus.DRAFT]: msg`Generate Links`,
      [DocumentStatus.PENDING]: msg`View Document`,
      [DocumentStatus.COMPLETED]: msg`View Document`,
      [DocumentStatus.REJECTED]: msg`View Document`,
    },
  };

  const distributionMethod = watch('meta.distributionMethod');
  const emailSettings = watch('meta.emailSettings');

  const onFormSubmit = handleSubmit(onSubmit);
  const { currentStep, totalSteps, previousStep } = useStep();

  const { scheduleSave } = useAutoSave(onAutoSave);

  const handleAutoSave = async () => {
    const isFormValid = await trigger();

    if (!isFormValid) {
      return;
    }

    const formData = getValues();

    scheduleSave(formData);
  };

  useEffect(() => {
    const container = window.document.getElementById('document-flow-form-container');

    const handleBlur = () => {
      void handleAutoSave();
    };

    if (container) {
      container.addEventListener('blur', handleBlur, true);
      return () => {
        container.removeEventListener('blur', handleBlur, true);
      };
    }
  }, []);

  return (
    <>
      <DocumentFlowFormContainerHeader
        title={documentFlow.title}
        description={documentFlow.description}
      />
      <DocumentFlowFormContainerContent>
        <div className="flex flex-col">
          {isDocumentPdfLoaded && (
            <DocumentReadOnlyFields
              showRecipientColors={true}
              recipientIds={recipients.map((recipient) => recipient.id)}
              fields={mapFieldsWithRecipients(fields, recipients)}
            />
          )}

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

          <AnimatePresence mode="wait">
            {distributionMethod === DocumentDistributionMethod.EMAIL && (
              <motion.div
                key={'Emails'}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0, transition: { duration: 0.3 } }}
                exit={{ opacity: 0, transition: { duration: 0.15 } }}
              >
                <Form {...form}>
                  <fieldset
                    className="flex flex-col gap-y-4 rounded-lg border p-4"
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
                                <SelectTrigger loading={isLoadingEmails} className="bg-background">
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

                    {/* <FormField
                      control={form.control}
                      name="meta.emailReplyName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            <Trans>Reply To Name</Trans>{' '}
                            <span className="text-muted-foreground">(Optional)</span>
                          </FormLabel>

                          <FormControl>
                            <Input {...field} />
                          </FormControl>

                          <FormMessage />
                        </FormItem>
                      )}
                    /> */}

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

                    <DocumentEmailCheckboxes
                      className="mt-2"
                      value={emailSettings}
                      onChange={(value) => setValue('meta.emailSettings', value)}
                    />
                  </fieldset>
                </Form>
              </motion.div>
            )}

            {distributionMethod === DocumentDistributionMethod.NONE && (
              <motion.div
                key={'Links'}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0, transition: { duration: 0.3 } }}
                exit={{ opacity: 0, transition: { duration: 0.15 } }}
                className="rounded-lg border"
              >
                {document.status === DocumentStatus.DRAFT ? (
                  <div className="text-muted-foreground py-16 text-center text-sm">
                    <p>
                      <Trans>We won't send anything to notify recipients.</Trans>
                    </p>

                    <p className="mt-2">
                      <Trans>
                        We will generate signing links for you, which you can send to the recipients
                        through your method of choice.
                      </Trans>
                    </p>
                  </div>
                ) : (
                  <ul className="text-muted-foreground divide-y">
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
                            <p className="text-muted-foreground text-sm">{recipient.email}</p>
                          }
                          secondaryText={
                            <p className="text-muted-foreground/70 text-xs">
                              {_(RECIPIENT_ROLES_DESCRIPTION[recipient.role].roleName)}
                            </p>
                          }
                        />

                        {recipient.role !== RecipientRole.CC && (
                          <CopyTextButton
                            value={formatSigningLink(recipient.token)}
                            onCopySuccess={() => {
                              toast({
                                title: _(msg`Copied to clipboard`),
                                description: _(
                                  msg`The signing link has been copied to your clipboard.`,
                                ),
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
      </DocumentFlowFormContainerContent>

      <DocumentFlowFormContainerFooter>
        <DocumentFlowFormContainerStep step={currentStep} maxStep={totalSteps} />

        <DocumentFlowFormContainerActions
          loading={isSubmitting}
          disabled={isSubmitting}
          goNextLabel={GoNextLabel[distributionMethod][document.status]}
          onGoBackClick={previousStep}
          onGoNextClick={() => void onFormSubmit()}
        />
      </DocumentFlowFormContainerFooter>
    </>
  );
};
