'use client';

import { useEffect } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { InfoIcon } from 'lucide-react';
import { useForm } from 'react-hook-form';

import { DATE_FORMATS, DEFAULT_DOCUMENT_DATE_FORMAT } from '@documenso/lib/constants/date-formats';
import { DEFAULT_DOCUMENT_TIME_ZONE, TIME_ZONES } from '@documenso/lib/constants/time-zones';
import type { Template, TemplateDocumentMeta } from '@documenso/prisma/client';
import { type Recipient, SendStatus } from '@documenso/prisma/client';
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
  DocumentFlowFormContainerStep,
} from '../document-flow/document-flow-root';
import type { DocumentFlowStep } from '../document-flow/types';
import { Input } from '../input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../select';
import { useStep } from '../stepper';
import { Textarea } from '../textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '../tooltip';
import type { TTemplateSettingsFormSchema } from './add-template-settings.types';
import { ZTemplateSettingsFormSchema } from './add-template-settings.types';

export type AddSettingsFormProps = {
  template: Template;
  documentFlow: DocumentFlowStep;
  recipients: Recipient[];
  documentMeta: TemplateDocumentMeta | null;
  onSubmit: (_data: TTemplateSettingsFormSchema) => void;
};

export const AddTemplateSettingsFormPartial = ({
  documentFlow,
  recipients,
  documentMeta,
  template,
  onSubmit,
}: AddSettingsFormProps) => {
  const form = useForm<TTemplateSettingsFormSchema>({
    resolver: zodResolver(ZTemplateSettingsFormSchema),
    defaultValues: {
      title: template.title,
      meta: {
        subject: documentMeta?.subject ?? '',
        message: documentMeta?.message ?? '',
        timezone: documentMeta?.timezone ?? DEFAULT_DOCUMENT_TIME_ZONE,
        dateFormat: documentMeta?.dateFormat ?? DEFAULT_DOCUMENT_DATE_FORMAT,
        redirectUrl: documentMeta?.redirectUrl ?? '',
      },
    },
  });

  const { stepIndex, currentStep, totalSteps, previousStep } = useStep();

  const documentHasBeenSent = recipients.some(
    (recipient) => recipient.sendStatus === SendStatus.SENT,
  );

  useEffect(() => {
    if (!form.formState.touchedFields.meta?.timezone && !documentHasBeenSent) {
      form.setValue('meta.timezone', Intl.DateTimeFormat().resolvedOptions().timeZone);
    }
  }, [documentHasBeenSent, form, form.setValue, form.formState.touchedFields.meta?.timezone]);

  return (
    <>
      <DocumentFlowFormContainerContent>
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
                  <FormLabel required>Title</FormLabel>
                  <FormControl>
                    <Input className="bg-background" {...field} disabled={field.disabled} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Accordion type="multiple" className="mt-6">
              <AccordionItem value="advanced-options" className="border-none">
                <AccordionTrigger className="text-foreground mb-2 rounded border px-3 py-2 text-left hover:bg-neutral-200/30 hover:no-underline">
                  Advanced Options
                </AccordionTrigger>

                <AccordionContent className="text-muted-foreground -mx-1 px-1 pt-2 text-sm leading-relaxed">
                  <div className="flex flex-col space-y-6 ">
                    <FormField
                      control={form.control}
                      name="meta.dateFormat"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Date Format</FormLabel>

                          <FormControl>
                            <Select
                              {...field}
                              onValueChange={field.onChange}
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
                      name="meta.subject"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex flex-row items-center">
                            Subject{' '}
                            <Tooltip>
                              <TooltipTrigger>
                                <InfoIcon className="mx-2 h-4 w-4" />
                              </TooltipTrigger>

                              <TooltipContent className="text-muted-foreground max-w-xs">
                                Add email subject
                              </TooltipContent>
                            </Tooltip>
                          </FormLabel>

                          <FormControl>
                            <Input
                              id="subject"
                              className="bg-background mt-2"
                              disabled={field.disabled}
                              {...field}
                            />
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
                            Message{' '}
                            <Tooltip>
                              <TooltipTrigger>
                                <InfoIcon className="mx-2 h-4 w-4" />
                              </TooltipTrigger>

                              <TooltipContent className="text-muted-foreground max-w-xs">
                                Add message to send in the email
                              </TooltipContent>
                            </Tooltip>
                          </FormLabel>

                          <FormControl>
                            <Textarea
                              id="message"
                              className="bg-background mt-2 h-24 resize-none"
                              {...field}
                            />
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
                              className="bg-background"
                              options={TIME_ZONES}
                              {...field}
                              onChange={(value) => value && field.onChange(value)}
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
