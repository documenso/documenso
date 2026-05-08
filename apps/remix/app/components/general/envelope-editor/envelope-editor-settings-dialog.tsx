import { useEffect, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react/macro';
import { Trans } from '@lingui/react/macro';
import {
  DocumentDistributionMethod,
  DocumentVisibility,
  EnvelopeType,
  RecipientRole,
  SendStatus,
  TemplateType,
} from '@prisma/client';
import type * as DialogPrimitive from '@radix-ui/react-dialog';
import { BellRingIcon, InfoIcon, MailIcon, SettingsIcon, ShieldIcon } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { match } from 'ts-pattern';
import { z } from 'zod';

import { useCurrentEnvelopeEditor } from '@documenso/lib/client-only/providers/envelope-editor-provider';
import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { DATE_FORMATS, DEFAULT_DOCUMENT_DATE_FORMAT } from '@documenso/lib/constants/date-formats';
import {
  DOCUMENT_DISTRIBUTION_METHODS,
  DOCUMENT_SIGNATURE_TYPES,
} from '@documenso/lib/constants/document';
import { ZEnvelopeExpirationPeriod } from '@documenso/lib/constants/envelope-expiration';
import { ZEnvelopeReminderSettings } from '@documenso/lib/constants/envelope-reminder';
import {
  SUPPORTED_LANGUAGES,
  SUPPORTED_LANGUAGE_CODES,
  isValidLanguageCode,
} from '@documenso/lib/constants/i18n';
import { DEFAULT_DOCUMENT_TIME_ZONE, TIME_ZONES } from '@documenso/lib/constants/time-zones';
import { DO_NOT_INVALIDATE_QUERY_ON_MUTATION } from '@documenso/lib/constants/trpc';
import { AppError } from '@documenso/lib/errors/app-error';
import {
  ZDocumentAccessAuthTypesSchema,
  ZDocumentActionAuthTypesSchema,
} from '@documenso/lib/types/document-auth';
import { ZDocumentEmailSettingsSchema } from '@documenso/lib/types/document-email';
import {
  type TDocumentMetaDateFormat,
  ZDocumentMetaDateFormatSchema,
  ZDocumentMetaTimezoneSchema,
} from '@documenso/lib/types/document-meta';
import { extractDocumentAuthMethods } from '@documenso/lib/utils/document-auth';
import { isValidRedirectUrl } from '@documenso/lib/utils/is-valid-redirect-url';
import {
  DocumentSignatureType,
  canAccessTeamDocument,
  extractTeamSignatureSettings,
} from '@documenso/lib/utils/teams';
import { zEmail } from '@documenso/lib/utils/zod';
import { trpc } from '@documenso/trpc/react';
import { DocumentEmailCheckboxes } from '@documenso/ui/components/document/document-email-checkboxes';
import {
  DocumentGlobalAuthAccessSelect,
  DocumentGlobalAuthAccessTooltip,
} from '@documenso/ui/components/document/document-global-auth-access-select';
import {
  DocumentGlobalAuthActionSelect,
  DocumentGlobalAuthActionTooltip,
} from '@documenso/ui/components/document/document-global-auth-action-select';
import { DocumentSendEmailMessageHelper } from '@documenso/ui/components/document/document-send-email-message-helper';
import { DocumentSignatureSettingsTooltip } from '@documenso/ui/components/document/document-signature-settings-tooltip';
import {
  DocumentVisibilitySelect,
  DocumentVisibilityTooltip,
} from '@documenso/ui/components/document/document-visibility-select';
import { ExpirationPeriodPicker } from '@documenso/ui/components/document/expiration-period-picker';
import { ReminderSettingsPicker } from '@documenso/ui/components/document/reminder-settings-picker';
import {
  TemplateTypeSelect,
  TemplateTypeTooltip,
} from '@documenso/ui/components/template/template-type-select';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import { CardDescription, CardHeader, CardTitle } from '@documenso/ui/primitives/card';
import { Combobox } from '@documenso/ui/primitives/combobox';
import {
  Dialog,
  DialogClose,
  DialogContent,
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
import { MultiSelectCombobox } from '@documenso/ui/primitives/multi-select-combobox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@documenso/ui/primitives/select';
import { Textarea } from '@documenso/ui/primitives/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@documenso/ui/primitives/tooltip';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { useCurrentTeam } from '~/providers/team';

export const ZAddSettingsFormSchema = z.object({
  templateType: z.nativeEnum(TemplateType).optional(),
  externalId: z.string().optional(),
  visibility: z.nativeEnum(DocumentVisibility).optional(),
  globalAccessAuth: z
    .array(z.union([ZDocumentAccessAuthTypesSchema, z.literal('-1')]))
    .transform((val) => (val.length === 1 && val[0] === '-1' ? [] : val))
    .optional()
    .default([]),
  globalActionAuth: z.array(ZDocumentActionAuthTypesSchema).optional().default([]),
  meta: z.object({
    subject: z.string(),
    message: z.string(),
    timezone: ZDocumentMetaTimezoneSchema.default(DEFAULT_DOCUMENT_TIME_ZONE),
    dateFormat: ZDocumentMetaDateFormatSchema.default(DEFAULT_DOCUMENT_DATE_FORMAT),
    distributionMethod: z
      .nativeEnum(DocumentDistributionMethod)
      .optional()
      .default(DocumentDistributionMethod.EMAIL),
    redirectUrl: z
      .string()
      .optional()
      .refine((value) => value === undefined || value === '' || isValidRedirectUrl(value), {
        message:
          'Please enter a valid URL, make sure you include http:// or https:// part of the url.',
      }),
    language: z
      .union([z.string(), z.enum(SUPPORTED_LANGUAGE_CODES)])
      .optional()
      .default('en'),
    emailId: z.string().nullable(),
    emailReplyTo: z.preprocess((val) => (val === '' ? undefined : val), zEmail().optional()),
    emailSettings: ZDocumentEmailSettingsSchema,
    signatureTypes: z.array(z.nativeEnum(DocumentSignatureType)).min(1, {
      message: msg`At least one signature type must be enabled`.id,
    }),
    envelopeExpirationPeriod: ZEnvelopeExpirationPeriod.optional(),
    reminderSettings: ZEnvelopeReminderSettings.optional(),
  }),
});

export type TAddSettingsFormSchema = z.infer<typeof ZAddSettingsFormSchema>;

export type EnvelopeEditorSettingsDialogProps = {
  children: React.ReactNode;
  initialSettings?: Partial<TAddSettingsFormSchema>;
  disabled?: boolean;
  team?: {
    teamEmails: { id: string; email: string }[];
    teamEmailSettings: TAddSettingsFormSchema['meta']['emailSettings'];
  };
  trigger?: React.ComponentPropsWithoutRef<typeof DialogTrigger>;
} & Omit<React.ComponentPropsWithoutRef<typeof DialogContent>, 'children'>;

export const EnvelopeEditorSettingsDialog = ({
  children,
  initialSettings,
  disabled,
  team,
  trigger,
  ...props
}: EnvelopeEditorSettingsDialogProps) => {
  const [open, setOpen] = useState(false);

  const { toast } = useToast();
  const { _ } = useLingui();

  const { document, recipients, setDocument, setMeta } = useCurrentEnvelopeEditor();
  const organisation = useCurrentOrganisation();
  const currentTeam = useCurrentTeam();

  const {
    data: emails = [],
    isLoading: isLoadingEmails,
    error: emailsError,
  } = trpc.profile.findUserEmails.useQuery(
    {},
    {
      enabled: open && organisation?.organisationClaim?.flags?.emailDomains,
    },
  );

  const envelopeHasBeenSent = document.status !== SendStatus.DRAFT;

  const documentAccessAuthMethods = extractDocumentAuthMethods({
    documentAuth: document.authOptions,
  });

  const teamSignatureSettings = extractTeamSignatureSettings({
    documentAuthOptions: document.authOptions,
    team: currentTeam,
  });

  const form = useForm<TAddSettingsFormSchema>({
    resolver: zodResolver(ZAddSettingsFormSchema),
    defaultValues: {
      externalId: document.externalId ?? '',
      templateType: document.templateType ?? undefined,
      visibility: document.visibility,
      globalAccessAuth: documentAccessAuthMethods,
      globalActionAuth: document.authOptions?.globalActionAuth ?? [],
      meta: {
        subject: document.documentMeta?.subject ?? '',
        message: document.documentMeta?.message ?? '',
        timezone: document.documentMeta?.timezone ?? DEFAULT_DOCUMENT_TIME_ZONE,
        dateFormat: (document.documentMeta?.dateFormat as TDocumentMetaDateFormat) ??
          DEFAULT_DOCUMENT_DATE_FORMAT,
        redirectUrl: document.documentMeta?.redirectUrl ?? '',
        distributionMethod:
          document.documentMeta?.distributionMethod ?? DocumentDistributionMethod.EMAIL,
        language: isValidLanguageCode(document.documentMeta?.language)
          ? document.documentMeta?.language
          : 'en',
        emailId: document.documentMeta?.emailId ?? null,
        emailReplyTo: document.documentMeta?.emailReplyTo ?? '',
        emailSettings: {
          ...(team?.teamEmailSettings ?? {}),
          ...document.documentMeta?.emailSettings,
        },
        signatureTypes: teamSignatureSettings,
        envelopeExpirationPeriod: document.envelopeExpirationPeriod ?? undefined,
        reminderSettings: document.reminderSettings ?? undefined,
      },
      ...initialSettings,
    },
  });

  const distributionMethod = form.watch('meta.distributionMethod');
  const templateType = form.watch('templateType');
  const globalAccessAuth = form.watch('globalAccessAuth');
  const globalActionAuth = form.watch('globalActionAuth');
  const signatureTypes = form.watch('meta.signatureTypes');
  const visibility = form.watch('visibility');

  const isTemplate = templateType === TemplateType.PUBLIC;
  const isDocumentActionAuthEnabled = globalActionAuth && globalActionAuth.length > 0;

  const isRecipientActionAuthEnabled = recipients.some((recipient) => {
    return recipient.authOptions && Object.keys(recipient.authOptions).length > 0;
  });

  const isDocumentAccessAuthRequired = globalAccessAuth && globalAccessAuth.length > 0;

  useEffect(() => {
    if (!open) {
      return;
    }

    const subscription = form.watch(() => {
      const formValues = form.getValues();

      setMeta(formValues.meta);
    });

    return () => subscription.unsubscribe();
  }, [open, form, setMeta]);

  const onFormSubmit = async ({ meta, ...settings }: TAddSettingsFormSchema) => {
    try {
      setDocument({
        ...settings,
        documentMeta: {
          subject: meta.subject,
          message: meta.message,
          timezone: meta.timezone,
          dateFormat: meta.dateFormat,
          language: meta.language,
          redirectUrl: meta.redirectUrl,
          distributionMethod: meta.distributionMethod,
          emailId: meta.emailId,
          emailReplyTo: meta.emailReplyTo,
          emailSettings: meta.emailSettings,
        },
        envelopeExpirationPeriod: meta.envelopeExpirationPeriod,
        reminderSettings: meta.reminderSettings,
      });

      toast({
        title: _(msg`Success`),
        description: _(msg`Document settings updated`),
        duration: 5000,
      });

      setOpen(false);
    } catch (err) {
      console.error(err);

      const error = AppError.parseError(err);

      toast({
        title: error.code,
        description: error.message,
        variant: 'destructive',
        duration: 10000,
      });
    }
  };

  const activeTabMatcher = (): string => {
    const selectedTab = match({ distributionMethod, isTemplate })
      .with({ distributionMethod: DocumentDistributionMethod.EMAIL }, () => 'email' as const)
      .with({ distributionMethod: DocumentDistributionMethod.SINGLE_LINK }, () => 'link' as const)
      .otherwise(() => 'general' as const);

    return selectedTab;
  };

  const settings = {
    allowConfigureSigningOrder: true,
    allowConfigureTimezone: true,
    allowConfigureDateFormat: true,
    allowConfigureExternalId: !envelopeHasBeenSent,
    allowConfigureEmailNotification: !isTemplate,
    allowConfigureRedirectUrl: !isTemplate,
    allowConfigureGlobalAccessAuth: true,
    allowConfigureGlobalActionAuth: true,
    allowConfigureVisibility: true,
    allowConfigureTemplateType: true,
    allowConfigureEmailSender: !isTemplate,
    allowConfigureEmailReplyTo: !isTemplate,
    allowConfigureDistribution: !envelopeHasBeenSent && !isTemplate,
    allowConfigureExpirationPeriod: !envelopeHasBeenSent,
    allowConfigureReminders: !envelopeHasBeenSent,
    allowConfigureSignatureSettings: true,
    allowConfigureLanguage: true,
  };

  const activeTab = activeTabMatcher();

  const MAX_FILE_SIZE_IN_MB = 50;

  if (emailsError) {
    toast({
      title: _(msg`Unable to load emails`),
      description: _(
        msg`We were unable to load your verified email addresses. Please refresh and try again.`,
      ),
      variant: 'destructive',
      duration: 10000,
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => !disabled && setOpen(value)}
    >
      <DialogTrigger disabled={disabled} {...trigger}>
        {children}
      </DialogTrigger>

      <DialogContent className="max-w-xl" {...props}>
        <DialogHeader>
          <DialogTitle>
            <Trans>Settings</Trans>
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onFormSubmit)}>
            <fieldset
              className="flex h-full flex-col space-y-4"
              disabled={form.formState.isSubmitting}
            >
              <div className="custom-scrollbar -mx-1 max-h-[60vh] flex-1 overflow-y-auto px-1">
                <div className="grid grid-cols-3 gap-4 border-b pb-4">
                  {[
                    { key: 'general', icon: SettingsIcon, label: _(msg`General`) },
                    { key: 'email', icon: MailIcon, label: _(msg`Email`) },
                    { key: 'reminders', icon: BellRingIcon, label: _(msg`Reminders`) },
                  ].map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      className={cn(
                        'flex flex-col items-center justify-center rounded-lg border p-3 text-sm font-medium transition-colors',
                        activeTab === tab.key
                          ? 'border-documenso bg-documenso/10 text-documenso-foreground'
                          : 'border-border text-muted-foreground hover:bg-muted',
                      )}
                      onClick={() => {
                        if (tab.key === 'email') {
                          form.setValue('meta.distributionMethod', DocumentDistributionMethod.EMAIL);
                        } else if (tab.key === 'link') {
                          form.setValue('meta.distributionMethod', DocumentDistributionMethod.SINGLE_LINK);
                        }
                      }}
                    >
                      <tab.icon className="mb-2 h-5 w-5" />
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className="mt-4 space-y-4">
                  {match({ activeTab, settings })
                    .with({ activeTab: 'general' }, () => (
                      <>
                        {settings.allowConfigureTemplateType && (
                          <FormField
                            control={form.control}
                            name="templateType"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="flex flex-row items-center">
                                  <Trans>Template Type</Trans>
                                  <TemplateTypeTooltip />
                                </FormLabel>

                                <FormControl>
                                  <TemplateTypeSelect
                                    {...field}
                                    onValueChange={(value) =>
                                      field.onChange(value === 'none' ? undefined : value)
                                    }
                                    value={field.value ?? 'none'}
                                  />
                                </FormControl>

                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        )}

                        {settings.allowConfigureExternalId && (
                          <FormField
                            control={form.control}
                            name="externalId"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>
                                  <Trans>External ID</Trans>
                                </FormLabel>

                                <FormControl>
                                  <Input {...field} />
                                </FormControl>

                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        )}

                        {settings.allowConfigureVisibility && (
                          <FormField
                            control={form.control}
                            name="visibility"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="flex flex-row items-center">
                                  <Trans>Visibility</Trans>
                                  <DocumentVisibilityTooltip />
                                </FormLabel>

                                <FormControl>
                                  <DocumentVisibilitySelect {...field} />
                                </FormControl>

                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        )}

                        {settings.allowConfigureGlobalAccessAuth && (
                          <FormField
                            control={form.control}
                            name="globalAccessAuth"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="flex flex-row items-center">
                                  <Trans>Access Authentication</Trans>
                                  <DocumentGlobalAuthAccessTooltip />
                                </FormLabel>

                                <FormControl>
                                  <DocumentGlobalAuthAccessSelect
                                    disabled={
                                      isRecipientActionAuthEnabled ||
                                      visibility === DocumentVisibility.MANAGER_AND_ABOVE ||
                                      visibility === DocumentVisibility.ADMIN
                                    }
                                    {...field}
                                  />
                                </FormControl>

                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        )}

                        {settings.allowConfigureGlobalActionAuth && (
                          <FormField
                            control={form.control}
                            name="globalActionAuth"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="flex flex-row items-center">
                                  <Trans>Action Authentication</Trans>
                                  <DocumentGlobalAuthActionTooltip />
                                </FormLabel>

                                <FormControl>
                                  <DocumentGlobalAuthActionSelect
                                    disabled={isRecipientActionAuthEnabled}
                                    {...field}
                                  />
                                </FormControl>

                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        )}

                        {settings.allowConfigureSignatureSettings && (
                          <FormField
                            control={form.control}
                            name="meta.signatureTypes"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="flex flex-row items-center">
                                  <Trans>Signature Settings</Trans>
                                  <DocumentSignatureSettingsTooltip />
                                </FormLabel>

                                <FormControl>
                                  <MultiSelectCombobox
                                    options={DOCUMENT_SIGNATURE_TYPES.map((item) => ({
                                      label: item.title,
                                      value: item.value,
                                    }))}
                                    placeholder={_(msg`Select signature settings`)}
                                    value={field.value}
                                    onChange={field.onChange}
                                    disabled={isDocumentActionAuthEnabled}
                                  />
                                </FormControl>

                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        )}

                        {settings.allowConfigureLanguage && (
                          <FormField
                            control={form.control}
                            name="meta.language"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>
                                  <Trans>Language</Trans>
                                </FormLabel>

                                <FormControl>
                                  <Combobox
                                    options={SUPPORTED_LANGUAGES}
                                    value={field.value}
                                    onChange={field.onChange}
                                  />
                                </FormControl>

                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        )}

                        {settings.allowConfigureTimezone && (
                          <FormField
                            control={form.control}
                            name="meta.timezone"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>
                                  <Trans>Timezone</Trans>
                                </FormLabel>

                                <FormControl>
                                  <Combobox
                                    options={TIME_ZONES}
                                    value={field.value}
                                    onChange={field.onChange}
                                  />
                                </FormControl>

                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        )}

                        {settings.allowConfigureDateFormat && (
                          <FormField
                            control={form.control}
                            name="meta.dateFormat"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>
                                  <Trans>Date Format</Trans>
                                </FormLabel>

                                <FormControl>
                                  <Combobox
                                    options={DATE_FORMATS}
                                    value={field.value}
                                    onChange={field.onChange}
                                  />
                                </FormControl>

                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        )}

                        {settings.allowConfigureRedirectUrl && (
                          <FormField
                            control={form.control}
                            name="meta.redirectUrl"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>
                                  <Trans>Redirect URL</Trans>
                                </FormLabel>

                                <FormControl>
                                  <Input {...field} />
                                </FormControl>

                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        )}

                        {settings.allowConfigureDistribution && (
                          <FormField
                            control={form.control}
                            name="meta.distributionMethod"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>
                                  <Trans>Distribution Method</Trans>
                                </FormLabel>

                                <FormControl>
                                  <Select {...field} onValueChange={field.onChange}>
                                    <SelectTrigger className="bg-background">
                                      <SelectValue />
                                    </SelectTrigger>

                                    <SelectContent>
                                      {DOCUMENT_DISTRIBUTION_METHODS.map(({ value, description }) => (
                                        <SelectItem key={value} value={value}>
                                          {_(description)}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </FormControl>

                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        )}

                        {settings.allowConfigureExpirationPeriod && (
                          <FormField
                            control={form.control}
                            name="meta.envelopeExpirationPeriod"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="flex flex-row items-center">
                                  <Trans>Expiration</Trans>
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <InfoIcon className="mx-2 h-4 w-4" />
                                    </TooltipTrigger>

                                    <TooltipContent className="max-w-xs text-muted-foreground">
                                      <Trans>
                                        How long recipients have to complete this document after it is
                                        sent. Uses the team default when set to inherit.
                                      </Trans>
                                    </TooltipContent>
                                  </Tooltip>
                                </FormLabel>

                                <FormControl>
                                  <ExpirationPeriodPicker
                                    value={field.value}
                                    onChange={field.onChange}
                                    disabled={envelopeHasBeenSent}
                                  />
                                </FormControl>

                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        )}
                      </>
                    ))
                    .with(
                      { activeTab: 'reminders', settings: { allowConfigureReminders: true } },
                      () => (
                        <FormField
                          control={form.control}
                          name="meta.reminderSettings"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="flex flex-row items-center">
                                <Trans>Signing Reminders</Trans>
                                <Tooltip>
                                  <TooltipTrigger>
                                    <InfoIcon className="mx-2 h-4 w-4" />
                                  </TooltipTrigger>

                                  <TooltipContent className="max-w-xs text-muted-foreground">
                                    <Trans>
                                      Configure when and how often reminder emails are sent to
                                      recipients who have not yet completed signing. Uses the team
                                      default when set to inherit.
                                    </Trans>
                                  </TooltipContent>
                                </Tooltip>
                              </FormLabel>

                              <FormControl>
                                <ReminderSettingsPicker
                                  value={field.value}
                                  onChange={field.onChange}
                                />
                              </FormControl>

                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      ),
                    )
                    .with(
                      { activeTab: 'email', settings: { allowConfigureDistribution: true } },
                      () => (
                        <>
                          {settings.allowConfigureEmailSender &&
                            organisation.organisationClaim.flags.emailDomains && (
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

                                          <SelectItem value={'-1'}>Davinci Sign</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </FormControl>

                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            )}

                          {settings.allowConfigureEmailReplyTo && (
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
                                    <Input {...field} />
                                  </FormControl>

                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          )}

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
                                  <Input {...field} />
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
                                    Message <span className="text-muted-foreground">(Optional)</span>
                                  </Trans>
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <InfoIcon className="mx-2 h-4 w-4" />
                                    </TooltipTrigger>
                                    <TooltipContent className="p-4 text-muted-foreground">
                                      <DocumentSendEmailMessageHelper />
                                    </TooltipContent>
                                  </Tooltip>
                                </FormLabel>

                                <FormControl>
                                  <Textarea className="h-16 resize-none bg-background" {...field} />
                                </FormControl>

                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          {settings.allowConfigureEmailNotification && (
                            <FormField
                              control={form.control}
                              name="meta.emailSettings"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>
                                    <Trans>Email Settings</Trans>
                                  </FormLabel>

                                  <FormControl>
                                    <DocumentEmailCheckboxes {...field} />
                                  </FormControl>

                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          )}
                        </>
                      ),
                    )
                    .otherwise(() => null)}
                </div>
              </div>

              <div className="mt-4 flex flex-row-reverse space-x-4 space-x-reverse">
                <Button
                  type="submit"
                  loading={form.formState.isSubmitting}
                  disabled={!form.formState.isDirty}
                >
                  <Trans>Save</Trans>
                </Button>

                <DialogClose asChild>
                  <Button type="button" variant="secondary">
                    <Trans>Cancel</Trans>
                  </Button>
                </DialogClose>
              </div>
            </fieldset>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};