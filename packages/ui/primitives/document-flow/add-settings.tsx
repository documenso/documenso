'use client';

import { useEffect } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { InfoIcon } from 'lucide-react';
import { useForm } from 'react-hook-form';

import { DATE_FORMATS, DEFAULT_DOCUMENT_DATE_FORMAT } from '@documenso/lib/constants/date-formats';
import { DOCUMENT_AUTH_TYPES } from '@documenso/lib/constants/document-auth';
import { DEFAULT_DOCUMENT_TIME_ZONE, TIME_ZONES } from '@documenso/lib/constants/time-zones';
import { DocumentAccessAuth, DocumentActionAuth } from '@documenso/lib/types/document-auth';
import { extractDocumentAuthMethods } from '@documenso/lib/utils/document-auth';
import { DocumentStatus, type Field, type Recipient, SendStatus } from '@documenso/prisma/client';
import type { DocumentWithData } from '@documenso/prisma/types/document-with-data';
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
import { ShowFieldItem } from './show-field-item';
import type { DocumentFlowStep } from './types';

export type AddSettingsFormProps = {
  documentFlow: DocumentFlowStep;
  recipients: Recipient[];
  fields: Field[];
  isDocumentEnterprise: boolean;
  isDocumentPdfLoaded: boolean;
  document: DocumentWithData;
  onSubmit: (_data: TAddSettingsFormSchema) => void;
};

export const AddSettingsFormPartial = ({
  documentFlow,
  recipients,
  fields,
  isDocumentEnterprise,
  isDocumentPdfLoaded,
  document,
  onSubmit,
}: AddSettingsFormProps) => {
  const { documentAuthOption } = extractDocumentAuthMethods({
    documentAuth: document.authOptions,
  });

  const form = useForm<TAddSettingsFormSchema>({
    resolver: zodResolver(ZAddSettingsFormSchema),
    defaultValues: {
      title: document.title,
      globalAccessAuth: documentAuthOption?.globalAccessAuth || undefined,
      globalActionAuth: documentAuthOption?.globalActionAuth || undefined,
      meta: {
        timezone: document.documentMeta?.timezone ?? DEFAULT_DOCUMENT_TIME_ZONE,
        dateFormat: document.documentMeta?.dateFormat ?? DEFAULT_DOCUMENT_DATE_FORMAT,
        redirectUrl: document.documentMeta?.redirectUrl ?? '',
      },
    },
  });

  const { stepIndex, currentStep, totalSteps, previousStep } = useStep();

  const documentHasBeenSent = recipients.some(
    (recipient) => recipient.sendStatus === SendStatus.SENT,
  );

  // We almost always want to set the timezone to the user's local timezone to avoid confusion
  // when the document is signed.
  useEffect(() => {
    if (!form.formState.touchedFields.meta?.timezone && !documentHasBeenSent) {
      form.setValue('meta.timezone', Intl.DateTimeFormat().resolvedOptions().timeZone);
    }
  }, [documentHasBeenSent, form, form.setValue, form.formState.touchedFields.meta?.timezone]);

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
                  <FormLabel required>Title</FormLabel>

                  <FormControl>
                    <Input
                      className="bg-background"
                      {...field}
                      disabled={document.status !== DocumentStatus.DRAFT || field.disabled}
                    />
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
                    <Tooltip>
                      <TooltipTrigger>
                        <InfoIcon className="mx-2 h-4 w-4" />
                      </TooltipTrigger>

                      <TooltipContent className="text-foreground max-w-md space-y-2 p-4">
                        <h2>
                          <strong>Document access</strong>
                        </h2>

                        <p>The authentication required for recipients to view the document.</p>

                        <ul className="ml-3.5 list-outside list-disc space-y-0.5 py-2">
                          <li>
                            <strong>Require account</strong> - The recipient must be signed in to
                            view the document
                          </li>
                          <li>
                            <strong>None</strong> - The document can be accessed directly by the URL
                            sent to the recipient
                          </li>
                        </ul>
                      </TooltipContent>
                    </Tooltip>
                  </FormLabel>

                  <FormControl>
                    <Select {...field} onValueChange={field.onChange}>
                      <SelectTrigger className="bg-background text-muted-foreground">
                        <SelectValue data-testid="documentAccessSelectValue" placeholder="None" />
                      </SelectTrigger>

                      <SelectContent position="popper">
                        {Object.values(DocumentAccessAuth).map((authType) => (
                          <SelectItem key={authType} value={authType}>
                            {DOCUMENT_AUTH_TYPES[authType].value}
                          </SelectItem>
                        ))}

                        {/* Note: -1 is remapped in the Zod schema to the required value. */}
                        <SelectItem value={'-1'}>None</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                </FormItem>
              )}
            />

            {isDocumentEnterprise && (
              <FormField
                control={form.control}
                name="globalActionAuth"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex flex-row items-center">
                      Recipient action authentication
                      <Tooltip>
                        <TooltipTrigger>
                          <InfoIcon className="mx-2 h-4 w-4" />
                        </TooltipTrigger>

                        <TooltipContent className="text-foreground max-w-md space-y-2 p-4">
                          <h2>
                            <strong>Global recipient action authentication</strong>
                          </h2>

                          <p>
                            The authentication required for recipients to sign the signature field.
                          </p>

                          <p>
                            This can be overriden by setting the authentication requirements
                            directly on each recipient in the next step.
                          </p>

                          <ul className="ml-3.5 list-outside list-disc space-y-0.5 py-2">
                            <li>
                              <strong>Require account</strong> - The recipient must be signed in
                            </li>
                            <li>
                              <strong>Require passkey</strong> - The recipient must have an account
                              and passkey configured via their settings
                            </li>
                            <li>
                              <strong>Require 2FA</strong> - The recipient must have an account and
                              2FA enabled via their settings
                            </li>
                            <li>
                              <strong>None</strong> - No authentication required
                            </li>
                          </ul>
                        </TooltipContent>
                      </Tooltip>
                    </FormLabel>

                    <FormControl>
                      <Select {...field} onValueChange={field.onChange}>
                        <SelectTrigger className="bg-background text-muted-foreground">
                          <SelectValue data-testid="documentActionSelectValue" placeholder="None" />
                        </SelectTrigger>

                        <SelectContent position="popper">
                          {Object.values(DocumentActionAuth).map((authType) => (
                            <SelectItem key={authType} value={authType}>
                              {DOCUMENT_AUTH_TYPES[authType].value}
                            </SelectItem>
                          ))}

                          {/* Note: -1 is remapped in the Zod schema to the required value. */}
                          <SelectItem value={'-1'}>None</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormControl>
                  </FormItem>
                )}
              />
            )}

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
