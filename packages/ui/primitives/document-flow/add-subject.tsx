'use client';

import { useEffect } from 'react';

import { Controller, useForm } from 'react-hook-form';

import { DATE_FORMATS, DEFAULT_DOCUMENT_DATE_FORMAT } from '@documenso/lib/constants/date-formats';
import { DEFAULT_DOCUMENT_TIME_ZONE, TIME_ZONES } from '@documenso/lib/constants/time-zones';
import type { Field, Recipient } from '@documenso/prisma/client';
import { DocumentStatus } from '@documenso/prisma/client';
import { SendStatus } from '@documenso/prisma/client';
import type { DocumentWithData } from '@documenso/prisma/types/document-with-data';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@documenso/ui/primitives/accordion';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@documenso/ui/primitives/select';

import { Combobox } from '../combobox';
import { FormErrorMessage } from '../form/form-error-message';
import { Input } from '../input';
import { Label } from '../label';
import { useStep } from '../stepper';
import { Textarea } from '../textarea';
import type { TAddSubjectFormSchema } from './add-subject.types';
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
  document: DocumentWithData;
  onSubmit: (_data: TAddSubjectFormSchema) => void;
};

export const AddSubjectFormPartial = ({
  documentFlow,
  recipients: recipients,
  fields: fields,
  document,
  onSubmit,
}: AddSubjectFormProps) => {
  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isSubmitting, touchedFields },
    getValues,
    setValue,
  } = useForm<TAddSubjectFormSchema>({
    defaultValues: {
      meta: {
        subject: document.documentMeta?.subject ?? '',
        message: document.documentMeta?.message ?? '',
        timezone: document.documentMeta?.timezone ?? DEFAULT_DOCUMENT_TIME_ZONE,
        dateFormat: document.documentMeta?.dateFormat ?? DEFAULT_DOCUMENT_DATE_FORMAT,
      },
    },
  });

  const onFormSubmit = handleSubmit(onSubmit);
  const { currentStep, totalSteps, previousStep } = useStep();

  const hasDateField = fields.find((field) => field.type === 'DATE');

  const documentHasBeenSent = recipients.some(
    (recipient) => recipient.sendStatus === SendStatus.SENT,
  );

  // We almost always want to set the timezone to the user's local timezone to avoid confusion
  // when the document is signed.
  useEffect(() => {
    if (!touchedFields.meta?.timezone && !documentHasBeenSent) {
      setValue('meta.timezone', Intl.DateTimeFormat().resolvedOptions().timeZone);
    }
  }, [documentHasBeenSent, setValue, touchedFields.meta?.timezone]);

  return (
    <>
      <DocumentFlowFormContainerHeader
        title={documentFlow.title}
        description={documentFlow.description}
      />
      <DocumentFlowFormContainerContent>
        <div className="flex flex-col">
          <div className="flex flex-col gap-y-4">
            <div>
              <Label htmlFor="subject">
                Subject <span className="text-muted-foreground">(Optional)</span>
              </Label>

              <Input
                id="subject"
                // placeholder="Subject"
                className="bg-background mt-2"
                disabled={isSubmitting}
                {...register('meta.subject')}
              />

              <FormErrorMessage className="mt-2" error={errors.meta?.subject} />
            </div>

            <div>
              <Label htmlFor="message">
                Message <span className="text-muted-foreground">(Optional)</span>
              </Label>

              <Textarea
                id="message"
                className="bg-background mt-2 h-32 resize-none"
                disabled={isSubmitting}
                {...register('meta.message')}
              />

              <FormErrorMessage
                className="mt-2"
                error={typeof errors.meta?.message !== 'string' ? errors.meta?.message : undefined}
              />
            </div>

            <div>
              <p className="text-muted-foreground text-sm">
                You can use the following variables in your message:
              </p>

              <ul className="mt-2 flex list-inside list-disc flex-col gap-y-2 text-sm">
                <li className="text-muted-foreground">
                  <code className="text-muted-foreground bg-muted-foreground/20 rounded p-1 text-sm">
                    {'{signer.name}'}
                  </code>{' '}
                  - The signer's name
                </li>
                <li className="text-muted-foreground">
                  <code className="text-muted-foreground bg-muted-foreground/20 rounded p-1 text-sm">
                    {'{signer.email}'}
                  </code>{' '}
                  - The signer's email
                </li>
                <li className="text-muted-foreground">
                  <code className="text-muted-foreground bg-muted-foreground/20 rounded p-1 text-sm">
                    {'{document.name}'}
                  </code>{' '}
                  - The document's name
                </li>
              </ul>
            </div>

            {hasDateField && (
              <Accordion type="multiple" className="mt-8 border-none">
                <AccordionItem value="advanced-options" className="border-none">
                  <AccordionTrigger className="mb-2 border-b text-left hover:no-underline">
                    Advanced Options
                  </AccordionTrigger>

                  <AccordionContent className="text-muted-foreground -mx-1 flex max-w-prose flex-col px-1 text-sm leading-relaxed">
                    <div className="mt-2 flex flex-col">
                      <Label htmlFor="date-format">
                        Date Format <span className="text-muted-foreground">(Optional)</span>
                      </Label>

                      <Controller
                        control={control}
                        name={`meta.dateFormat`}
                        disabled={documentHasBeenSent}
                        render={({ field: { value, onChange, disabled } }) => (
                          <Select value={value} onValueChange={onChange} disabled={disabled}>
                            <SelectTrigger className="bg-background mt-2">
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
                        )}
                      />
                    </div>

                    <div className="mt-4 flex flex-col">
                      <Label htmlFor="time-zone">
                        Time Zone <span className="text-muted-foreground">(Optional)</span>
                      </Label>

                      <Controller
                        control={control}
                        name={`meta.timezone`}
                        render={({ field: { value, onChange } }) => (
                          <Combobox
                            className="bg-background"
                            options={TIME_ZONES}
                            value={value}
                            onChange={(value) => value && onChange(value)}
                            disabled={documentHasBeenSent}
                          />
                        )}
                      />
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            )}
          </div>
        </div>
      </DocumentFlowFormContainerContent>

      <DocumentFlowFormContainerFooter>
        <DocumentFlowFormContainerStep
          title={documentFlow.title}
          step={currentStep}
          maxStep={totalSteps}
        />

        <DocumentFlowFormContainerActions
          loading={isSubmitting}
          disabled={isSubmitting}
          goNextLabel={document.status === DocumentStatus.DRAFT ? 'Send' : 'Update'}
          onGoBackClick={previousStep}
          onGoNextClick={() => void onFormSubmit()}
        />
      </DocumentFlowFormContainerFooter>
    </>
  );
};
