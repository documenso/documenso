import { useEffect } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { Trans, useLingui } from '@lingui/react/macro';
import { DocumentVisibility, TeamMemberRole } from '@prisma/client';
import { DocumentDistributionMethod, type Field, type Recipient } from '@prisma/client';
import { InfoIcon } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { match } from 'ts-pattern';

import { useAutoSave } from '@documenso/lib/client-only/hooks/use-autosave';
import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { DATE_FORMATS, DEFAULT_DOCUMENT_DATE_FORMAT } from '@documenso/lib/constants/date-formats';
import {
  DOCUMENT_DISTRIBUTION_METHODS,
  DOCUMENT_SIGNATURE_TYPES,
} from '@documenso/lib/constants/document';
import { SUPPORTED_LANGUAGES } from '@documenso/lib/constants/i18n';
import { DEFAULT_DOCUMENT_TIME_ZONE, TIME_ZONES } from '@documenso/lib/constants/time-zones';
import { ZDocumentEmailSettingsSchema } from '@documenso/lib/types/document-email';
import type { TDocumentMetaDateFormat } from '@documenso/lib/types/document-meta';
import type { TTemplate } from '@documenso/lib/types/template';
import { extractDocumentAuthMethods } from '@documenso/lib/utils/document-auth';
import { extractTeamSignatureSettings } from '@documenso/lib/utils/teams';
import { trpc } from '@documenso/trpc/react';
import {
  DocumentGlobalAuthAccessSelect,
  DocumentGlobalAuthAccessTooltip,
} from '@documenso/ui/components/document/document-global-auth-access-select';
import {
  DocumentGlobalAuthActionSelect,
  DocumentGlobalAuthActionTooltip,
} from '@documenso/ui/components/document/document-global-auth-action-select';
import { DocumentSendEmailMessageHelper } from '@documenso/ui/components/document/document-send-email-message-helper';
import {
  DocumentVisibilitySelect,
  DocumentVisibilityTooltip,
} from '@documenso/ui/components/document/document-visibility-select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@documenso/ui/primitives/accordion';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@documenso/ui/primitives/form/form';

import { DocumentEmailCheckboxes } from '../../components/document/document-email-checkboxes';
import {
  DocumentReadOnlyFields,
  mapFieldsWithRecipients,
} from '../../components/document/document-read-only-fields';
import { DocumentSignatureSettingsTooltip } from '../../components/document/document-signature-settings-tooltip';
import { Combobox } from '../combobox';
import {
  DocumentFlowFormContainerActions,
  DocumentFlowFormContainerContent,
  DocumentFlowFormContainerFooter,
  DocumentFlowFormContainerHeader,
  DocumentFlowFormContainerStep,
} from '../document-flow/document-flow-root';
import type { DocumentFlowStep } from '../document-flow/types';
import { Input } from '../input';
import { MultiSelectCombobox } from '../multi-select-combobox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../select';
import { useStep } from '../stepper';
import { Textarea } from '../textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '../tooltip';
import type { TAddTemplateSettingsFormSchema } from './add-template-settings.types';
import { ZAddTemplateSettingsFormSchema } from './add-template-settings.types';

export type AddTemplateSettingsFormProps = {
  documentFlow: DocumentFlowStep;
  recipients: Recipient[];
  fields: Field[];
  isDocumentPdfLoaded: boolean;
  template: TTemplate;
  currentTeamMemberRole?: TeamMemberRole;
  onSubmit: (_data: TAddTemplateSettingsFormSchema) => void;
  onAutoSave: (_data: TAddTemplateSettingsFormSchema) => Promise<void>;
};

export const AddTemplateSettingsFormPartial = ({
  documentFlow,
  recipients,
  fields,
  isDocumentPdfLoaded,
  template,
  currentTeamMemberRole,
  onSubmit,
  onAutoSave,
}: AddTemplateSettingsFormProps) => {
  const { t, i18n } = useLingui();

  const organisation = useCurrentOrganisation();

  const { documentAuthOption } = extractDocumentAuthMethods({
    documentAuth: template.authOptions,
  });

  const form = useForm<TAddTemplateSettingsFormSchema>({
    resolver: zodResolver(ZAddTemplateSettingsFormSchema),
    defaultValues: {
      title: template.title,
      externalId: template.externalId || undefined,
      visibility: template.visibility || '',
      globalAccessAuth: documentAuthOption?.globalAccessAuth || [],
      globalActionAuth: documentAuthOption?.globalActionAuth || [],
      meta: {
        subject: template.templateMeta?.subject ?? '',
        message: template.templateMeta?.message ?? '',
        timezone: template.templateMeta?.timezone ?? DEFAULT_DOCUMENT_TIME_ZONE,
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        dateFormat: (template.templateMeta?.dateFormat ??
          DEFAULT_DOCUMENT_DATE_FORMAT) as TDocumentMetaDateFormat,
        distributionMethod:
          template.templateMeta?.distributionMethod || DocumentDistributionMethod.EMAIL,
        redirectUrl: template.templateMeta?.redirectUrl ?? '',
        language: template.templateMeta?.language ?? 'en',
        emailId: template.templateMeta?.emailId ?? null,
        emailReplyTo: template.templateMeta?.emailReplyTo ?? undefined,
        emailSettings: ZDocumentEmailSettingsSchema.parse(template?.templateMeta?.emailSettings),
        signatureTypes: extractTeamSignatureSettings(template?.templateMeta),
      },
    },
  });

  const { stepIndex, currentStep, totalSteps, previousStep } = useStep();

  const distributionMethod = form.watch('meta.distributionMethod');
  const emailSettings = form.watch('meta.emailSettings');

  const { data: emailData, isLoading: isLoadingEmails } =
    trpc.enterprise.organisation.email.find.useQuery({
      organisationId: organisation.id,
      perPage: 100,
    });

  const emails = emailData?.data || [];

  const canUpdateVisibility = match(currentTeamMemberRole)
    .with(TeamMemberRole.ADMIN, () => true)
    .with(
      TeamMemberRole.MANAGER,
      () =>
        template.visibility === DocumentVisibility.EVERYONE ||
        template.visibility === DocumentVisibility.MANAGER_AND_ABOVE,
    )
    .otherwise(() => false);

  // We almost always want to set the timezone to the user's local timezone to avoid confusion
  // when the document is signed.
  useEffect(() => {
    if (!form.formState.touchedFields.meta?.timezone && !template.templateMeta?.timezone) {
      form.setValue('meta.timezone', Intl.DateTimeFormat().resolvedOptions().timeZone);
    }
  }, [form, form.setValue, form.formState.touchedFields.meta?.timezone]);

  const { scheduleSave } = useAutoSave(onAutoSave);

  const handleAutoSave = async () => {
    const isFormValid = await form.trigger();

    if (!isFormValid) {
      return;
    }

    const formData = form.getValues();

    /*
     * Parse the form data through the Zod schema to handle transformations
     * (like -1 -> undefined for the Document Global Auth Access)
     */
    const parseResult = ZAddTemplateSettingsFormSchema.safeParse(formData);

    if (parseResult.success) {
      scheduleSave(parseResult.data);
    }
  };

  return (
    <>
      <DocumentFlowFormContainerHeader
        title={documentFlow.title}
        description={documentFlow.description}
      />

      <DocumentFlowFormContainerContent>
        {isDocumentPdfLoaded && (
          <DocumentReadOnlyFields
            showRecipientColors={true}
            recipientIds={recipients.map((recipient) => recipient.id)}
            fields={mapFieldsWithRecipients(fields, recipients)}
          />
        )}

        <Form {...form}>
          <fieldset
            className="flex h-full flex-col space-y-6"
            disabled={form.formState.isSubmitting}
          >
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>
                    <Trans>Template title</Trans>
                  </FormLabel>

                  <FormControl>
                    <Input
                      className="bg-background"
                      {...field}
                      maxLength={255}
                      onBlur={handleAutoSave}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="meta.language"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="inline-flex items-center">
                    <Trans>Language</Trans>
                    <Tooltip>
                      <TooltipTrigger>
                        <InfoIcon className="mx-2 h-4 w-4" />
                      </TooltipTrigger>

                      <TooltipContent className="text-foreground max-w-md space-y-2 p-4">
                        Controls the language for the document, including the language to be used
                        for email notifications, and the final certificate that is generated and
                        attached to the document.
                      </TooltipContent>
                    </Tooltip>
                  </FormLabel>

                  <FormControl>
                    <Select
                      {...field}
                      onValueChange={(value) => {
                        field.onChange(value);
                        void handleAutoSave();
                      }}
                    >
                      <SelectTrigger className="bg-background">
                        <SelectValue />
                      </SelectTrigger>

                      <SelectContent>
                        {Object.entries(SUPPORTED_LANGUAGES).map(([code, language]) => (
                          <SelectItem key={code} value={code}>
                            {language.full}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="globalAccessAuth"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex flex-row items-center">
                    <Trans>Document access</Trans>
                    <DocumentGlobalAuthAccessTooltip />
                  </FormLabel>

                  <FormControl>
                    <DocumentGlobalAuthAccessSelect
                      {...field}
                      onValueChange={(value) => {
                        field.onChange(value);
                        void handleAutoSave();
                      }}
                      value={field.value}
                      disabled={field.disabled}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            {currentTeamMemberRole && (
              <FormField
                control={form.control}
                name="visibility"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex flex-row items-center">
                      <Trans>Document visibility</Trans>
                      <DocumentVisibilityTooltip />
                    </FormLabel>

                    <FormControl>
                      <DocumentVisibilitySelect
                        canUpdateVisibility={canUpdateVisibility}
                        currentTeamMemberRole={currentTeamMemberRole}
                        {...field}
                        onValueChange={(value) => {
                          field.onChange(value);
                          void handleAutoSave();
                        }}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="meta.distributionMethod"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex flex-row items-center">
                    <Trans>Document Distribution Method</Trans>
                    <Tooltip>
                      <TooltipTrigger>
                        <InfoIcon className="mx-2 h-4 w-4" />
                      </TooltipTrigger>

                      <TooltipContent className="text-foreground max-w-md space-y-2 p-4">
                        <h2>
                          <strong>
                            <Trans>Document Distribution Method</Trans>
                          </strong>
                        </h2>

                        <p>
                          <Trans>
                            This is how the document will reach the recipients once the document is
                            ready for signing.
                          </Trans>
                        </p>

                        <ul className="ml-3.5 list-outside list-disc space-y-0.5 py-2">
                          <li>
                            <Trans>
                              <strong>Email</strong> - The recipient will be emailed the document to
                              sign, approve, etc.
                            </Trans>
                          </li>
                          <li>
                            <Trans>
                              <strong>None</strong> - We will generate links which you can send to
                              the recipients manually.
                            </Trans>
                          </li>
                        </ul>

                        <Trans>
                          <strong>Note</strong> - If you use Links in combination with direct
                          templates, you will need to manually send the links to the remaining
                          recipients.
                        </Trans>
                      </TooltipContent>
                    </Tooltip>
                  </FormLabel>

                  <FormControl>
                    <Select
                      {...field}
                      onValueChange={(value) => {
                        field.onChange(value);
                        void handleAutoSave();
                      }}
                    >
                      <SelectTrigger className="bg-background text-muted-foreground">
                        <SelectValue data-testid="documentDistributionMethodSelectValue" />
                      </SelectTrigger>

                      <SelectContent position="popper">
                        {Object.values(DOCUMENT_DISTRIBUTION_METHODS).map(
                          ({ value, description }) => (
                            <SelectItem key={value} value={value}>
                              {i18n._(description)}
                            </SelectItem>
                          ),
                        )}
                      </SelectContent>
                    </Select>
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="meta.signatureTypes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex flex-row items-center">
                    <Trans>Allowed Signature Types</Trans>
                    <DocumentSignatureSettingsTooltip />
                  </FormLabel>

                  <FormControl>
                    <MultiSelectCombobox
                      options={Object.values(DOCUMENT_SIGNATURE_TYPES).map((option) => ({
                        label: t(option.label),
                        value: option.value,
                      }))}
                      selectedValues={field.value}
                      onChange={(value) => {
                        field.onChange(value);
                        void handleAutoSave();
                      }}
                      className="bg-background w-full"
                      emptySelectionPlaceholder={t`Select signature types`}
                    />
                  </FormControl>

                  <FormMessage />
                </FormItem>
              )}
            />

            {organisation.organisationClaim.flags.cfr21 && (
              <FormField
                control={form.control}
                name="globalActionAuth"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex flex-row items-center">
                      <Trans>Recipient action authentication</Trans>
                      <DocumentGlobalAuthActionTooltip />
                    </FormLabel>

                    <FormControl>
                      <DocumentGlobalAuthActionSelect
                        {...field}
                        onValueChange={(value) => {
                          field.onChange(value);
                          void handleAutoSave();
                        }}
                        value={field.value}
                        disabled={field.disabled}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            )}

            {distributionMethod === DocumentDistributionMethod.EMAIL && (
              <Accordion type="multiple">
                <AccordionItem value="email-options" className="border-none">
                  <AccordionTrigger className="text-foreground rounded border px-3 py-2 text-left hover:bg-neutral-200/30 hover:no-underline">
                    <Trans>Email Options</Trans>
                  </AccordionTrigger>

                  <AccordionContent className="text-muted-foreground -mx-1 px-1 pt-4 text-sm leading-relaxed [&>div]:pb-0">
                    <div className="flex flex-col space-y-6">
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
                              <Trans>
                                Subject <span className="text-muted-foreground">(Optional)</span>
                              </Trans>
                            </FormLabel>

                            <FormControl>
                              <Input {...field} maxLength={254} onBlur={handleAutoSave} />
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
                                className="bg-background h-16 resize-none"
                                {...field}
                                maxLength={5000}
                                onBlur={handleAutoSave}
                              />
                            </FormControl>

                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <DocumentEmailCheckboxes
                        value={emailSettings}
                        onChange={(value) => {
                          form.setValue('meta.emailSettings', value, {
                            shouldDirty: true,
                          });
                          void handleAutoSave();
                        }}
                      />
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            )}

            <Accordion type="multiple">
              <AccordionItem value="advanced-options" className="border-none">
                <AccordionTrigger className="text-foreground rounded border px-3 py-2 text-left hover:bg-neutral-200/30 hover:no-underline">
                  <Trans>Advanced Options</Trans>
                </AccordionTrigger>

                <AccordionContent className="text-muted-foreground -mx-1 px-1 pt-4 text-sm leading-relaxed">
                  <div className="flex flex-col space-y-6">
                    <FormField
                      control={form.control}
                      name="externalId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex flex-row items-center">
                            <Trans>External ID</Trans>{' '}
                            <Tooltip>
                              <TooltipTrigger>
                                <InfoIcon className="mx-2 h-4 w-4" />
                              </TooltipTrigger>

                              <TooltipContent className="text-muted-foreground max-w-xs">
                                <Trans>
                                  Add an external ID to the template. This can be used to identify
                                  in external systems.
                                </Trans>
                              </TooltipContent>
                            </Tooltip>
                          </FormLabel>

                          <FormControl>
                            <Input
                              className="bg-background"
                              {...field}
                              maxLength={255}
                              onBlur={handleAutoSave}
                            />
                          </FormControl>

                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="meta.dateFormat"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            <Trans>Date Format</Trans>
                          </FormLabel>

                          <FormControl>
                            <Select
                              {...field}
                              onValueChange={(value) => {
                                field.onChange(value);
                                void handleAutoSave();
                              }}
                            >
                              <SelectTrigger className="bg-background">
                                <SelectValue />
                              </SelectTrigger>

                              <SelectContent>
                                {DATE_FORMATS.map((format) => (
                                  <SelectItem key={format.key} value={format.value}>
                                    {format.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </FormControl>

                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="meta.timezone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            <Trans>Time Zone</Trans>
                          </FormLabel>

                          <FormControl>
                            <Combobox
                              className="bg-background time-zone-field"
                              options={TIME_ZONES}
                              {...field}
                              onChange={(value) => {
                                value && field.onChange(value);
                                void handleAutoSave();
                              }}
                            />
                          </FormControl>

                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="meta.redirectUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex flex-row items-center">
                            <Trans>Redirect URL</Trans>{' '}
                            <Tooltip>
                              <TooltipTrigger>
                                <InfoIcon className="mx-2 h-4 w-4" />
                              </TooltipTrigger>

                              <TooltipContent className="text-muted-foreground max-w-xs">
                                <Trans>
                                  Add a URL to redirect the user to once the document is signed
                                </Trans>
                              </TooltipContent>
                            </Tooltip>
                          </FormLabel>

                          <FormControl>
                            <Input
                              className="bg-background"
                              {...field}
                              maxLength={255}
                              onBlur={handleAutoSave}
                            />
                          </FormControl>

                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </fieldset>
        </Form>
      </DocumentFlowFormContainerContent>

      <DocumentFlowFormContainerFooter>
        <DocumentFlowFormContainerStep step={currentStep} maxStep={totalSteps} />

        <DocumentFlowFormContainerActions
          loading={form.formState.isSubmitting}
          disabled={form.formState.isSubmitting}
          canGoBack={stepIndex !== 0}
          onGoBackClick={previousStep}
          onGoNextClick={form.handleSubmit(onSubmit)}
        />
      </DocumentFlowFormContainerFooter>
    </>
  );
};
