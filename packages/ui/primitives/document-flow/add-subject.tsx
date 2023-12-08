'use client';

import { useForm } from 'react-hook-form';

import { DATE_FORMATS } from '@documenso/lib/constants/date-formats';
import { TIME_ZONES_FULL } from '@documenso/lib/constants/time-zones';
import type { Field, Recipient } from '@documenso/prisma/client';
import { DocumentStatus } from '@documenso/prisma/client';
import type { DocumentWithData } from '@documenso/prisma/types/document-with-data';
import { FormErrorMessage } from '@documenso/ui/primitives/form/form-error-message';
import { Input } from '@documenso/ui/primitives/input';
import { Label } from '@documenso/ui/primitives/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@documenso/ui/primitives/select';
import { Textarea } from '@documenso/ui/primitives/textarea';

import { Combobox } from '../combobox';
import type { TAddSubjectFormSchema } from './add-subject.types';
import {
  DocumentFlowFormContainerActions,
  DocumentFlowFormContainerContent,
  DocumentFlowFormContainerFooter,
  DocumentFlowFormContainerStep,
} from './document-flow-root';
import type { DocumentFlowStep } from './types';

export type AddSubjectFormProps = {
  documentFlow: DocumentFlowStep;
  recipients: Recipient[];
  fields: Field[];
  document: DocumentWithData;
  numberOfSteps: number;
  onSubmit: (_data: TAddSubjectFormSchema) => void;
};

export const AddSubjectFormPartial = ({
  documentFlow,
  recipients: _recipients,
  fields: _fields,
  document,
  numberOfSteps,
  onSubmit,
}: AddSubjectFormProps) => {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    getValues,
    setValue,
  } = useForm<TAddSubjectFormSchema>({
    defaultValues: {
      email: {
        subject: document.documentMeta?.subject ?? '',
        message: document.documentMeta?.message ?? '',
        timezone: document.documentMeta?.timezone ?? 'Europe/London',
        dateFormat: document.documentMeta?.dateFormat ?? 'MM-DD-YYYY',
      },
    },
  });

  const onFormSubmit = handleSubmit(onSubmit);

  const hasDateField = _fields.find((field) => field.type === 'DATE');

  return (
    <>
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
                {...register('email.subject')}
              />

              <FormErrorMessage className="mt-2" error={errors.email?.subject} />
            </div>

            <div>
              <Label htmlFor="message">
                Message <span className="text-muted-foreground">(Optional)</span>
              </Label>

              <Textarea
                id="message"
                className="bg-background mt-2 h-32 resize-none"
                disabled={isSubmitting}
                {...register('email.message')}
              />

              <FormErrorMessage
                className="mt-2"
                error={
                  typeof errors.email?.message !== 'string' ? errors.email?.message : undefined
                }
              />
            </div>

            {hasDateField && (
              <div className="flex flex-col">
                <Label htmlFor="time-zone">
                  Date Format <span className="text-muted-foreground">(Optional)</span>
                </Label>

                <Select
                  onValueChange={(value) => setValue('email.dateFormat', value)}
                  defaultValue={getValues('email.dateFormat')}
                >
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
              </div>
            )}

            {hasDateField && (
              <div className="flex flex-col">
                <Label htmlFor="time-zone">
                  Time Zone <span className="text-muted-foreground">(Optional)</span>
                </Label>

                <Combobox
                  listValues={TIME_ZONES_FULL}
                  onChange={(value) => setValue('email.timezone', value)}
                  selectedValue={getValues('email.timezone')}
                />
              </div>
            )}

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
          </div>
        </div>
      </DocumentFlowFormContainerContent>

      <DocumentFlowFormContainerFooter>
        <DocumentFlowFormContainerStep
          title={documentFlow.title}
          step={documentFlow.stepIndex}
          maxStep={numberOfSteps}
        />

        <DocumentFlowFormContainerActions
          loading={isSubmitting}
          disabled={isSubmitting}
          goNextLabel={document.status === DocumentStatus.DRAFT ? 'Send' : 'Update'}
          onGoBackClick={documentFlow.onBackStep}
          onGoNextClick={() => void onFormSubmit()}
        />
      </DocumentFlowFormContainerFooter>
    </>
  );
};
