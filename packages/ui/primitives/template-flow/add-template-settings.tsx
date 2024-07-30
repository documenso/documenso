'use client';

import { useEffect } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { InfoIcon } from 'lucide-react';
import { useForm } from 'react-hook-form';

import { DATE_FORMATS, DEFAULT_DOCUMENT_DATE_FORMAT } from '@documenso/lib/constants/date-formats';
import { DEFAULT_DOCUMENT_TIME_ZONE, TIME_ZONES } from '@documenso/lib/constants/time-zones';
import { extractDocumentAuthMethods } from '@documenso/lib/utils/document-auth';
import { type Field, type Recipient } from '@documenso/prisma/client';
import type { TemplateWithData } from '@documenso/prisma/types/template';
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

import { Combobox } from '../combobox';
import {
  DocumentFlowFormContainerActions,
  DocumentFlowFormContainerContent,
  DocumentFlowFormContainerFooter,
  DocumentFlowFormContainerHeader,
  DocumentFlowFormContainerStep,
} from '../document-flow/document-flow-root';
import { ShowFieldItem } from '../document-flow/show-field-item';
import type { DocumentFlowStep } from '../document-flow/types';
import { Input } from '../input';
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
  isEnterprise: boolean;
  isDocumentPdfLoaded: boolean;
  template: TemplateWithData;
  onSubmit: (_data: TAddTemplateSettingsFormSchema) => void;
};

export const AddTemplateSettingsFormPartial = ({
  documentFlow,
  recipients,
  fields,
  isEnterprise,
  isDocumentPdfLoaded,
  template,
  onSubmit,
}: AddTemplateSettingsFormProps) => {
  const { documentAuthOption } = extractDocumentAuthMethods({
    documentAuth: template.authOptions,
  });

  const form = useForm<TAddTemplateSettingsFormSchema>({
    resolver: zodResolver(ZAddTemplateSettingsFormSchema),
    defaultValues: {
      title: template.title,
      externalId: template.externalId || undefined,
      globalAccessAuth: documentAuthOption?.globalAccessAuth || undefined,
      globalActionAuth: documentAuthOption?.globalActionAuth || undefined,
      meta: {
        subject: template.templateMeta?.subject ?? '',
        message: template.templateMeta?.message ?? '',
        timezone: template.templateMeta?.timezone ?? DEFAULT_DOCUMENT_TIME_ZONE,
        dateFormat: template.templateMeta?.dateFormat ?? DEFAULT_DOCUMENT_DATE_FORMAT,
        redirectUrl: template.templateMeta?.redirectUrl ?? '',
      },
    },
  });

  const { stepIndex, currentStep, totalSteps, previousStep } = useStep();

  // We almost always want to set the timezone to the user's local timezone to avoid confusion
  // when the document is signed.
  useEffect(() => {
    if (!form.formState.touchedFields.meta?.timezone) {
      form.setValue('meta.timezone', Intl.DateTimeFormat().resolvedOptions().timeZone);
    }
  }, [form, form.setValue, form.formState.touchedFields.meta?.timezone]);

  return (
    <>
      <DocumentFlowFormContainerHeader
        title={documentFlow.title}
        description={documentFlow.description}
      />

      <DocumentFlowFormContainerContent>
        {isDocumentPdfLoaded &&
          fields.map((field, index) => (
            <ShowFieldItem key={index} field={field} recipients={recipients} />
          ))}

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
                  <FormLabel required>Template title</FormLabel>

                  <FormControl>
                    <Input className="bg-background" {...field} />
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
                    Document access
                    <DocumentGlobalAuthAccessTooltip />
                  </FormLabel>

                  <FormControl>
                    <DocumentGlobalAuthAccessSelect {...field} onValueChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            {isEnterprise && (
              <FormField
                control={form.control}
                name="globalActionAuth"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex flex-row items-center">
                      Recipient action authentication
                      <DocumentGlobalAuthActionTooltip />
                    </FormLabel>

                    <FormControl>
                      <DocumentGlobalAuthActionSelect {...field} onValueChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
            )}

            <Accordion type="multiple">
              <AccordionItem value="email-options" className="border-none">
                <AccordionTrigger className="text-foreground rounded border px-3 py-2 text-left hover:bg-neutral-200/30 hover:no-underline">
                  Email Options
                </AccordionTrigger>

                <AccordionContent className="text-muted-foreground -mx-1 px-1 pt-4 text-sm leading-relaxed [&>div]:pb-0">
                  <div className="flex flex-col space-y-6">
                    <FormField
                      control={form.control}
                      name="meta.subject"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            Subject <span className="text-muted-foreground">(Optional)</span>
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
                          <FormLabel>
                            Message <span className="text-muted-foreground">(Optional)</span>
                          </FormLabel>

                          <FormControl>
                            <Textarea className="bg-background h-32 resize-none" {...field} />
                          </FormControl>

                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <DocumentSendEmailMessageHelper />
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <Accordion type="multiple">
              <AccordionItem value="advanced-options" className="border-none">
                <AccordionTrigger className="text-foreground rounded border px-3 py-2 text-left hover:bg-neutral-200/30 hover:no-underline">
                  Advanced Options
                </AccordionTrigger>

                <AccordionContent className="text-muted-foreground -mx-1 px-1 pt-4 text-sm leading-relaxed">
                  <div className="flex flex-col space-y-6">
                    <FormField
                      control={form.control}
                      name="externalId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex flex-row items-center">
                            External ID{' '}
                            <Tooltip>
                              <TooltipTrigger>
                                <InfoIcon className="mx-2 h-4 w-4" />
                              </TooltipTrigger>

                              <TooltipContent className="text-muted-foreground max-w-xs">
                                Add an external ID to the template. This can be used to identify in
                                external systems.
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
                      name="meta.dateFormat"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Date Format</FormLabel>

                          <FormControl>
                            <Select {...field} onValueChange={field.onChange}>
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
                          <FormLabel>Time Zone</FormLabel>

                          <FormControl>
                            <Combobox
                              className="bg-background time-zone-field"
                              options={TIME_ZONES}
                              {...field}
                              onChange={(value) => value && field.onChange(value)}
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
                            Redirect URL{' '}
                            <Tooltip>
                              <TooltipTrigger>
                                <InfoIcon className="mx-2 h-4 w-4" />
                              </TooltipTrigger>

                              <TooltipContent className="text-muted-foreground max-w-xs">
                                Add a URL to redirect the user to once the document is signed
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
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </fieldset>
        </Form>
      </DocumentFlowFormContainerContent>

      <DocumentFlowFormContainerFooter>
        <DocumentFlowFormContainerStep
          title={documentFlow.title}
          step={currentStep}
          maxStep={totalSteps}
        />

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
