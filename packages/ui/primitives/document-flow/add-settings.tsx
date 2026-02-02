import { useEffect } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { Trans, useLingui } from '@lingui/react/macro';
import {
  DocumentStatus,
  DocumentVisibility,
  type Field,
  type Recipient,
  SendStatus,
  TeamMemberRole,
} from '@prisma/client';
import { InfoIcon } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { match } from 'ts-pattern';

import { useAutoSave } from '@documenso/lib/client-only/hooks/use-autosave';
import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { DATE_FORMATS, DEFAULT_DOCUMENT_DATE_FORMAT } from '@documenso/lib/constants/date-formats';
import { DOCUMENT_SIGNATURE_TYPES } from '@documenso/lib/constants/document';
import { SUPPORTED_LANGUAGES } from '@documenso/lib/constants/i18n';
import { DEFAULT_DOCUMENT_TIME_ZONE, TIME_ZONES } from '@documenso/lib/constants/time-zones';
import type { TDocument } from '@documenso/lib/types/document';
import { extractDocumentAuthMethods } from '@documenso/lib/utils/document-auth';
import { extractTeamSignatureSettings } from '@documenso/lib/utils/teams';
import {
  DocumentGlobalAuthAccessSelect,
  DocumentGlobalAuthAccessTooltip,
} from '@documenso/ui/components/document/document-global-auth-access-select';
import {
  DocumentGlobalAuthActionSelect,
  DocumentGlobalAuthActionTooltip,
} from '@documenso/ui/components/document/document-global-auth-action-select';
import {
  DocumentReadOnlyFields,
  mapFieldsWithRecipients,
} from '@documenso/ui/components/document/document-read-only-fields';
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
import { MultiSelectCombobox } from '@documenso/ui/primitives/multi-select-combobox';

import { DocumentSignatureSettingsTooltip } from '../../components/document/document-signature-settings-tooltip';
import { Combobox } from '../combobox';
import { Input } from '../input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../select';
import { useStep } from '../stepper';
import { Tooltip, TooltipContent, TooltipTrigger } from '../tooltip';
import type { TAddSettingsFormSchema } from './add-settings.types';
import { ZAddSettingsFormSchema } from './add-settings.types';
import {
  DocumentFlowFormContainerActions,
  DocumentFlowFormContainerContent,
  DocumentFlowFormContainerFooter,
  DocumentFlowFormContainerHeader,
  DocumentFlowFormContainerStep,
} from './document-flow-root';
import type { DocumentFlowStep } from './types';

export type AddSettingsFormProps = {
  documentFlow: DocumentFlowStep;
  recipients: Recipient[];
  fields: Field[];
  isDocumentPdfLoaded: boolean;
  document: TDocument;
  currentTeamMemberRole?: TeamMemberRole;
  onSubmit: (_data: TAddSettingsFormSchema) => void;
  onAutoSave: (_data: TAddSettingsFormSchema) => Promise<void>;
};

export const AddSettingsFormPartial = ({
  documentFlow,
  recipients,
  fields,
  isDocumentPdfLoaded,
  document,
  currentTeamMemberRole,
  onSubmit,
  onAutoSave,
}: AddSettingsFormProps) => {
  const { t } = useLingui();

  const organisation = useCurrentOrganisation();

  const { documentAuthOption } = extractDocumentAuthMethods({
    documentAuth: document.authOptions,
  });

  const form = useForm<TAddSettingsFormSchema>({
    resolver: zodResolver(ZAddSettingsFormSchema),
    defaultValues: {
      title: document.title,
      externalId: document.externalId || '',
      visibility: document.visibility || '',
      globalAccessAuth: documentAuthOption?.globalAccessAuth || [],
      globalActionAuth: documentAuthOption?.globalActionAuth || [],

      meta: {
        timezone:
          TIME_ZONES.find((timezone) => timezone === document.documentMeta?.timezone) ??
          DEFAULT_DOCUMENT_TIME_ZONE,
        dateFormat:
          DATE_FORMATS.find((format) => format.value === document.documentMeta?.dateFormat)
            ?.value ?? DEFAULT_DOCUMENT_DATE_FORMAT,
        redirectUrl: document.documentMeta?.redirectUrl ?? '',
        language: document.documentMeta?.language ?? 'en',
        signatureTypes: extractTeamSignatureSettings(document.documentMeta),
      },
    },
  });

  const { stepIndex, currentStep, totalSteps, previousStep } = useStep();

  const documentHasBeenSent = recipients.some(
    (recipient) => recipient.sendStatus === SendStatus.SENT,
  );

  const canUpdateVisibility = match(currentTeamMemberRole)
    .with(TeamMemberRole.ADMIN, () => true)
    .with(
      TeamMemberRole.MANAGER,
      () =>
        document.visibility === DocumentVisibility.EVERYONE ||
        document.visibility === DocumentVisibility.MANAGER_AND_ABOVE,
    )
    .otherwise(() => false);

  const onFormSubmit = form.handleSubmit(onSubmit);

  const onGoNextClick = () => {
    void onFormSubmit().catch(console.error);
  };

  // We almost always want to set the timezone to the user's local timezone to avoid confusion
  // when the document is signed.
  useEffect(() => {
    if (
      !form.formState.touchedFields.meta?.timezone &&
      !documentHasBeenSent &&
      !document.documentMeta?.timezone
    ) {
      form.setValue('meta.timezone', Intl.DateTimeFormat().resolvedOptions().timeZone);
    }
  }, [
    documentHasBeenSent,
    form,
    form.setValue,
    form.formState.touchedFields.meta?.timezone,
    document.documentMeta?.timezone,
  ]);

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
    const parseResult = ZAddSettingsFormSchema.safeParse(formData);

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
                    <Trans>Title</Trans>
                  </FormLabel>

                  <FormControl>
                    <Input
                      className="bg-background"
                      {...field}
                      disabled={document.status !== DocumentStatus.DRAFT || field.disabled}
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
                        <Trans>
                          Controls the language for the document, including the language to be used
                          for email notifications, and the final certificate that is generated and
                          attached to the document.
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
                      value={field.value}
                      disabled={field.disabled}
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

            <Accordion type="multiple" className="mt-6">
              <AccordionItem value="advanced-options" className="border-none">
                <AccordionTrigger className="text-foreground mb-2 rounded border px-3 py-2 text-left hover:bg-neutral-200/30 hover:no-underline">
                  <Trans>Advanced Options</Trans>
                </AccordionTrigger>

                <AccordionContent className="text-muted-foreground -mx-1 px-1 pt-2 text-sm leading-relaxed">
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
                                  Add an external ID to the document. This can be used to identify
                                  the document in external systems.
                                </Trans>
                              </TooltipContent>
                            </Tooltip>
                          </FormLabel>

                          <FormControl>
                            <Input className="bg-background" {...field} onBlur={handleAutoSave} />
                          </FormControl>

                          <FormMessage />
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
                              value={field.value}
                              disabled={documentHasBeenSent}
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
                              className="bg-background"
                              options={TIME_ZONES}
                              {...field}
                              onChange={(value) => {
                                value && field.onChange(value);
                                void handleAutoSave();
                              }}
                              value={field.value}
                              disabled={documentHasBeenSent}
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
                            <Input className="bg-background" {...field} onBlur={handleAutoSave} />
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
          onGoNextClick={onGoNextClick}
        />
      </DocumentFlowFormContainerFooter>
    </>
  );
};
