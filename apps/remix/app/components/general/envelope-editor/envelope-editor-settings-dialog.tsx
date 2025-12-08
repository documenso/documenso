import { useEffect, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { msg } from '@lingui/core/macro';
import { Trans, useLingui } from '@lingui/react/macro';
import {
  DocumentDistributionMethod,
  DocumentVisibility,
  EnvelopeType,
  SendStatus,
} from '@prisma/client';
import type * as DialogPrimitive from '@radix-ui/react-dialog';
import { InfoIcon, MailIcon, SettingsIcon, ShieldIcon } from 'lucide-react';
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
import {
  SUPPORTED_LANGUAGES,
  SUPPORTED_LANGUAGE_CODES,
  isValidLanguageCode,
} from '@documenso/lib/constants/i18n';
import { DEFAULT_DOCUMENT_TIME_ZONE, TIME_ZONES } from '@documenso/lib/constants/time-zones';
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
    emailReplyTo: z.preprocess(
      (val) => (val === '' ? undefined : val),
      z.string().email().optional(),
    ),
    emailSettings: ZDocumentEmailSettingsSchema,
    signatureTypes: z.array(z.nativeEnum(DocumentSignatureType)).min(1, {
      message: msg`At least one signature type must be enabled`.id,
    }),
  }),
});

type EnvelopeEditorSettingsTabType = 'general' | 'email' | 'security';

const tabs = [
  {
    id: 'general',
    title: msg`General`,
    icon: SettingsIcon,
    description: msg`Configure document settings and options before sending.`,
  },
  {
    id: 'email',
    title: msg`Email`,
    icon: MailIcon,
    description: msg`Configure email settings for the document`,
  },
  {
    id: 'security',
    title: msg`Security`,
    icon: ShieldIcon,
    description: msg`Configure security settings for the document`,
  },
] as const;

type TAddSettingsFormSchema = z.infer<typeof ZAddSettingsFormSchema>;

type EnvelopeEditorSettingsDialogProps = {
  trigger?: React.ReactNode;
} & Omit<DialogPrimitive.DialogProps, 'children'>;

export const EnvelopeEditorSettingsDialog = ({
  trigger,
  ...props
}: EnvelopeEditorSettingsDialogProps) => {
  const { t, i18n } = useLingui();
  const { toast } = useToast();

  const { envelope, updateEnvelopeAsync } = useCurrentEnvelopeEditor();

  const team = useCurrentTeam();
  const organisation = useCurrentOrganisation();

  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<EnvelopeEditorSettingsTabType>('general');

  const { documentAuthOption } = extractDocumentAuthMethods({
    documentAuth: envelope.authOptions,
  });

  const createDefaultValues = () => {
    return {
      externalId: envelope.externalId || '',
      visibility: envelope.visibility || '',
      globalAccessAuth: documentAuthOption?.globalAccessAuth || [],
      globalActionAuth: documentAuthOption?.globalActionAuth || [],
      meta: {
        subject: envelope.documentMeta.subject ?? '',
        message: envelope.documentMeta.message ?? '',
        timezone: envelope.documentMeta.timezone ?? DEFAULT_DOCUMENT_TIME_ZONE,
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        dateFormat: (envelope.documentMeta.dateFormat ??
          DEFAULT_DOCUMENT_DATE_FORMAT) as TDocumentMetaDateFormat,
        distributionMethod:
          envelope.documentMeta.distributionMethod || DocumentDistributionMethod.EMAIL,
        redirectUrl: envelope.documentMeta.redirectUrl ?? '',
        language: envelope.documentMeta.language ?? 'en',
        emailId: envelope.documentMeta.emailId ?? null,
        emailReplyTo: envelope.documentMeta.emailReplyTo ?? undefined,
        emailSettings: ZDocumentEmailSettingsSchema.parse(envelope.documentMeta.emailSettings),
        signatureTypes: extractTeamSignatureSettings(envelope.documentMeta),
      },
    };
  };

  const form = useForm<TAddSettingsFormSchema>({
    resolver: zodResolver(ZAddSettingsFormSchema),
    defaultValues: createDefaultValues(),
  });

  const envelopeHasBeenSent =
    envelope.type === EnvelopeType.DOCUMENT &&
    envelope.recipients.some((recipient) => recipient.sendStatus === SendStatus.SENT);

  const emailSettings = form.watch('meta.emailSettings');

  const { data: emailData, isLoading: isLoadingEmails } =
    trpc.enterprise.organisation.email.find.useQuery({
      organisationId: organisation.id,
      perPage: 100,
    });

  const emails = emailData?.data || [];

  const canUpdateVisibility = canAccessTeamDocument(team.currentTeamRole, envelope.visibility);

  const onFormSubmit = async (data: TAddSettingsFormSchema) => {
    const {
      timezone,
      dateFormat,
      redirectUrl,
      language,
      signatureTypes,
      distributionMethod,
      emailId,
      emailSettings,
      message,
      subject,
      emailReplyTo,
    } = data.meta;

    const parsedGlobalAccessAuth = z
      .array(ZDocumentAccessAuthTypesSchema)
      .safeParse(data.globalAccessAuth);

    try {
      await updateEnvelopeAsync({
        data: {
          externalId: data.externalId || null,
          visibility: data.visibility,
          globalAccessAuth: parsedGlobalAccessAuth.success ? parsedGlobalAccessAuth.data : [],
          globalActionAuth: data.globalActionAuth ?? [],
        },
        meta: {
          timezone,
          dateFormat,
          redirectUrl,
          emailId,
          message,
          subject,
          emailReplyTo,
          emailSettings,
          distributionMethod,
          language: isValidLanguageCode(language) ? language : undefined,
          drawSignatureEnabled: signatureTypes.includes(DocumentSignatureType.DRAW),
          typedSignatureEnabled: signatureTypes.includes(DocumentSignatureType.TYPE),
          uploadSignatureEnabled: signatureTypes.includes(DocumentSignatureType.UPLOAD),
        },
      });

      setOpen(false);

      toast({
        title: t`Success`,
        description: t`Envelope updated`,
        duration: 5000,
      });
    } catch (err) {
      const error = AppError.parseError(err);

      console.error(error);

      toast({
        title: t`An unknown error occurred`,
        description: t`We encountered an unknown error while attempting to update the envelope. Please try again later.`,
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    if (
      !form.formState.touchedFields.meta?.timezone &&
      !envelopeHasBeenSent &&
      !envelope.documentMeta.timezone
    ) {
      form.setValue('meta.timezone', Intl.DateTimeFormat().resolvedOptions().timeZone);
    }
  }, [
    envelopeHasBeenSent,
    form,
    form.setValue,
    form.formState.touchedFields.meta?.timezone,
    envelope.documentMeta.timezone,
  ]);

  useEffect(() => {
    form.reset(createDefaultValues());
    setActiveTab('general');
  }, [open, form]);

  const selectedTab = tabs.find((tab) => tab.id === activeTab);

  if (!selectedTab) {
    return null;
  }

  return (
    <Dialog
      {...props}
      open={open}
      onOpenChange={(value) => !form.formState.isSubmitting && setOpen(value)}
    >
      <DialogTrigger onClick={(e) => e.stopPropagation()} asChild={true}>
        {trigger ?? (
          <Button className="flex-shrink-0" variant="secondary">
            <Trans>Settings</Trans>
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="flex w-full !max-w-5xl flex-row gap-0 p-0">
        {/* Sidebar. */}
        <div className="bg-accent/20 flex w-80 flex-col border-r">
          <DialogHeader className="p-6 pb-4">
            <DialogTitle>Document Settings</DialogTitle>
          </DialogHeader>

          <nav className="col-span-12 mb-8 flex flex-wrap items-center justify-start gap-x-2 gap-y-4 px-4 md:col-span-3 md:w-full md:flex-col md:items-start md:gap-y-2">
            {tabs.map((tab) => (
              <Button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                variant="ghost"
                className={cn('w-full justify-start', {
                  'bg-secondary': activeTab === tab.id,
                })}
              >
                <tab.icon className="mr-2 h-5 w-5" />
                {t(tab.title)}
              </Button>
            ))}
          </nav>
        </div>

        {/* Content. */}
        <div className="flex w-full flex-col">
          <CardHeader className="border-b pb-4">
            <CardTitle>{t(selectedTab?.title ?? '')}</CardTitle>
            <CardDescription>{t(selectedTab?.description ?? '')}</CardDescription>
          </CardHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onFormSubmit)}>
              <fieldset
                className="flex h-[45rem] max-h-[calc(100vh-14rem)] w-full flex-col space-y-6 overflow-y-auto px-6 pt-6"
                disabled={form.formState.isSubmitting}
                key={activeTab}
              >
                {match(activeTab)
                  .with('general', () => (
                    <>
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
                                    Controls the language for the document, including the language
                                    to be used for email notifications, and the final certificate
                                    that is generated and attached to the document.
                                  </Trans>
                                </TooltipContent>
                              </Tooltip>
                            </FormLabel>

                            <FormControl>
                              <Select
                                value={field.value}
                                disabled={field.disabled}
                                onValueChange={field.onChange}
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
                                onChange={field.onChange}
                                className="bg-background w-full"
                                emptySelectionPlaceholder="Select signature types"
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
                                value={field.value}
                                onValueChange={field.onChange}
                                disabled={envelopeHasBeenSent}
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
                                value={field.value}
                                onChange={(value) => value && field.onChange(value)}
                                disabled={envelopeHasBeenSent}
                              />
                            </FormControl>

                            <FormMessage />
                          </FormItem>
                        )}
                      />
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
                              <Input className="bg-background" {...field} />
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
                              <Input className="bg-background" {...field} />
                            </FormControl>

                            <FormMessage />
                          </FormItem>
                        )}
                      />
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
                                      This is how the document will reach the recipients once the
                                      document is ready for signing.
                                    </Trans>
                                  </p>

                                  <ul className="ml-3.5 list-outside list-disc space-y-0.5 py-2">
                                    <li>
                                      <Trans>
                                        <strong>Email</strong> - The recipient will be emailed the
                                        document to sign, approve, etc.
                                      </Trans>
                                    </li>
                                    <li>
                                      <Trans>
                                        <strong>None</strong> - We will generate links which you can
                                        send to the recipients manually.
                                      </Trans>
                                    </li>
                                  </ul>

                                  <Trans>
                                    <strong>Note</strong> - If you use Links in combination with
                                    direct templates, you will need to manually send the links to
                                    the remaining recipients.
                                  </Trans>
                                </TooltipContent>
                              </Tooltip>
                            </FormLabel>

                            <FormControl>
                              <Select {...field} onValueChange={field.onChange}>
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
                    </>
                  ))
                  .with('email', () => (
                    <>
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
                              <Input {...field} />
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
                              <Textarea className="bg-background h-16 resize-none" {...field} />
                            </FormControl>

                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <DocumentEmailCheckboxes
                        value={emailSettings}
                        onChange={(value) => form.setValue('meta.emailSettings', value)}
                      />
                    </>
                  ))
                  .with('security', () => (
                    <>
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
                                  value={field.value}
                                  disabled={field.disabled}
                                  onValueChange={field.onChange}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      )}

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
                                value={field.value}
                                disabled={field.disabled}
                                onValueChange={field.onChange}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />

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
                                currentTeamMemberRole={team.currentTeamRole}
                                {...field}
                                onValueChange={field.onChange}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </>
                  ))
                  .exhaustive()}
              </fieldset>

              <div className="flex flex-row justify-end gap-4 p-6">
                <DialogClose asChild>
                  <Button variant="secondary" disabled={form.formState.isSubmitting}>
                    <Trans>Cancel</Trans>
                  </Button>
                </DialogClose>

                <Button type="submit" loading={form.formState.isSubmitting}>
                  <Trans>Update</Trans>
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
};
