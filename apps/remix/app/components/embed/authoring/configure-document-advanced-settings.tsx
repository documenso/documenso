import { Trans, useLingui } from '@lingui/react/macro';
import { DocumentDistributionMethod } from '@prisma/client';
import { InfoIcon } from 'lucide-react';
import type { Control } from 'react-hook-form';
import { useFormContext } from 'react-hook-form';

import { DATE_FORMATS } from '@documenso/lib/constants/date-formats';
import { DOCUMENT_SIGNATURE_TYPES } from '@documenso/lib/constants/document';
import { SUPPORTED_LANGUAGES } from '@documenso/lib/constants/i18n';
import { TIME_ZONES } from '@documenso/lib/constants/time-zones';
import { DocumentEmailCheckboxes } from '@documenso/ui/components/document/document-email-checkboxes';
import { DocumentSendEmailMessageHelper } from '@documenso/ui/components/document/document-send-email-message-helper';
import { Combobox } from '@documenso/ui/primitives/combobox';
import {
  FormControl,
  FormDescription,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@documenso/ui/primitives/tabs';
import { Textarea } from '@documenso/ui/primitives/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@documenso/ui/primitives/tooltip';

import { useConfigureDocument } from './configure-document-context';
import type { TConfigureEmbedFormSchema } from './configure-document-view.types';

interface ConfigureDocumentAdvancedSettingsProps {
  control: Control<TConfigureEmbedFormSchema>;
  isSubmitting: boolean;
}

export const ConfigureDocumentAdvancedSettings = ({
  control,
  isSubmitting,
}: ConfigureDocumentAdvancedSettingsProps) => {
  const { t } = useLingui();

  const form = useFormContext<TConfigureEmbedFormSchema>();
  const { features } = useConfigureDocument();

  const { watch, setValue } = form;

  // Lift watch() calls to reduce re-renders
  const distributionMethod = watch('meta.distributionMethod');
  const emailSettings = watch('meta.emailSettings');
  const isEmailDistribution = distributionMethod === DocumentDistributionMethod.EMAIL;

  return (
    <div>
      <h3 className="text-foreground mb-1 text-lg font-medium">
        <Trans>Advanced Settings</Trans>
      </h3>

      <p className="text-muted-foreground mb-6 text-sm">
        <Trans>Configure additional options and preferences</Trans>
      </p>

      <Tabs defaultValue="general">
        <TabsList className="mb-6 inline-flex">
          <TabsTrigger value="general" className="px-4">
            <Trans>General</Trans>
          </TabsTrigger>

          {features.allowConfigureCommunication && (
            <TabsTrigger value="communication" className="px-4">
              <Trans>Communication</Trans>
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="general" className="mt-0">
          <div className="flex flex-col space-y-6">
            {features.allowConfigureSignatureTypes && (
              <FormField
                control={control}
                name="meta.signatureTypes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      <Trans>Allowed Signature Types</Trans>
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
                        emptySelectionPlaceholder={t`Select signature types`}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {features.allowConfigureLanguage && (
              <FormField
                control={control}
                name="meta.language"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      <Trans>Language</Trans>
                    </FormLabel>
                    <FormControl>
                      <Select {...field} onValueChange={field.onChange} disabled={isSubmitting}>
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
            )}

            {features.allowConfigureDateFormat && (
              <FormField
                control={control}
                name="meta.dateFormat"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      <Trans>Date Format</Trans>
                    </FormLabel>
                    <FormControl>
                      <Select {...field} onValueChange={field.onChange} disabled={isSubmitting}>
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
            )}

            {features.allowConfigureTimezone && (
              <FormField
                control={control}
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
                        onChange={(value) => value && field.onChange(value)}
                        disabled={isSubmitting}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {features.allowConfigureRedirectUrl && (
              <FormField
                control={control}
                name="meta.redirectUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex flex-row items-center">
                      <Trans>Redirect URL</Trans>
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
                      <Input className="bg-background" {...field} disabled={isSubmitting} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
          </div>
        </TabsContent>

        {features.allowConfigureCommunication && (
          <TabsContent value="communication" className="mt-0">
            <div className="flex flex-col space-y-6">
              <FormField
                control={control}
                name="meta.distributionMethod"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      <Trans>Distribution Method</Trans>
                    </FormLabel>

                    <FormControl>
                      <Select {...field} onValueChange={field.onChange} disabled={isSubmitting}>
                        <SelectTrigger className="bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={DocumentDistributionMethod.EMAIL}>
                            <Trans>Email</Trans>
                          </SelectItem>
                          <SelectItem value={DocumentDistributionMethod.NONE}>
                            <Trans>None</Trans>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </FormControl>

                    <FormDescription>
                      <Trans>
                        Choose how to distribute your document to recipients. Email will send
                        notifications, None will generate signing links for manual distribution.
                      </Trans>
                    </FormDescription>

                    <FormMessage />
                  </FormItem>
                )}
              />

              <fieldset
                className="flex flex-col space-y-6 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={!isEmailDistribution}
              >
                <FormField
                  control={control}
                  name="meta.subject"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel htmlFor="subject">
                        <Trans>
                          Subject <span className="text-muted-foreground">(Optional)</span>
                        </Trans>
                      </FormLabel>
                      <FormControl>
                        <Input
                          id="subject"
                          className="bg-background mt-2"
                          disabled={isSubmitting || !isEmailDistribution}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={control}
                  name="meta.message"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel htmlFor="message">
                        <Trans>
                          Message <span className="text-muted-foreground">(Optional)</span>
                        </Trans>
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          id="message"
                          className="bg-background mt-2 h-32 resize-none"
                          disabled={isSubmitting || !isEmailDistribution}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DocumentSendEmailMessageHelper />

                <DocumentEmailCheckboxes
                  className={`mt-2 ${!isEmailDistribution ? 'pointer-events-none' : ''}`}
                  value={emailSettings}
                  onChange={(value) => setValue('meta.emailSettings', value)}
                />
              </fieldset>
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};
