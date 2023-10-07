'use client';

import { useForm } from 'react-hook-form';

import { Field, Recipient } from '@documenso/prisma/client';
import { FormErrorMessage } from '@documenso/ui/primitives/form/form-error-message';
import { Input } from '@documenso/ui/primitives/input';
import { Label } from '@documenso/ui/primitives/label';
import { Textarea } from '@documenso/ui/primitives/textarea';

import { TAddTemplateDetailsFormSchema } from './add-template-details.types';
import {
  DocumentFlowFormContainerActions,
  DocumentFlowFormContainerContent,
  DocumentFlowFormContainerFooter,
  DocumentFlowFormContainerStep,
} from './document-flow-root';
import { DocumentFlowStep } from './types';

export type UploadedDocument = { file: File; fileBase64: string };

export type AddTemplateDetailsFormProps = {
  documentFlow: DocumentFlowStep;
  recipients?: Recipient[];
  fields?: Field[];
  uploadedDocument: UploadedDocument;
  numberOfSteps: number;
  onSubmit: (_data: TAddTemplateDetailsFormSchema) => void;
};

export const AddTemplateDetailsFormPartial = ({
  documentFlow,
  recipients: _recipients,
  fields: _fields,
  uploadedDocument,
  numberOfSteps,
  onSubmit,
}: AddTemplateDetailsFormProps) => {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<TAddTemplateDetailsFormSchema>({
    defaultValues: {
      template: {
        title: uploadedDocument.file.name,
        description: '',
      },
    },
  });

  const onFormSubmit = handleSubmit(onSubmit);

  return (
    <>
      <DocumentFlowFormContainerContent>
        <div className="flex flex-col">
          <div className="flex flex-col gap-y-4">
            <div>
              <Label htmlFor="subject">Name</Label>

              <Input
                id="subject"
                // placeholder="Subject"
                className="bg-background mt-2"
                disabled={isSubmitting}
                {...register('template.title')}
              />

              <FormErrorMessage className="mt-2" error={errors.template?.title} />
            </div>

            <div>
              <Label htmlFor="message">
                Description <span className="text-muted-foreground">(Optional)</span>
              </Label>

              <Textarea
                id="message"
                className="bg-background mt-2 h-32 resize-none"
                disabled={isSubmitting}
                {...register('template.description')}
              />

              <FormErrorMessage
                className="mt-2"
                error={
                  typeof errors.template?.description !== 'string'
                    ? errors.template?.description
                    : undefined
                }
              />
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
          goNextLabel="Save Template"
          onGoBackClick={documentFlow.onBackStep}
          onGoNextClick={() => void onFormSubmit()}
        />
      </DocumentFlowFormContainerFooter>
    </>
  );
};
