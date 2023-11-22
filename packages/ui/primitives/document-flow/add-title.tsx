'use client';

import { useForm } from 'react-hook-form';

import type { Field, Recipient } from '@documenso/prisma/client';
import type { DocumentWithData } from '@documenso/prisma/types/document-with-data';
import { FormErrorMessage } from '@documenso/ui/primitives/form/form-error-message';
import { Input } from '@documenso/ui/primitives/input';
import { Label } from '@documenso/ui/primitives/label';

import type { TAddTitleFormSchema } from './add-title.types';
import {
  DocumentFlowFormContainerActions,
  DocumentFlowFormContainerContent,
  DocumentFlowFormContainerFooter,
  DocumentFlowFormContainerStep,
} from './document-flow-root';
import type { DocumentFlowStep } from './types';

export type AddTitleFormProps = {
  documentFlow: DocumentFlowStep;
  recipients: Recipient[];
  fields: Field[];
  document: DocumentWithData;
  numberOfSteps: number;
  onSubmit: (_data: TAddTitleFormSchema) => void;
};

export const AddTitleFormPartial = ({
  documentFlow,
  recipients: _recipients,
  fields: _fields,
  document,
  numberOfSteps,
  onSubmit,
}: AddTitleFormProps) => {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<TAddTitleFormSchema>({
    defaultValues: {
      title: document.title,
    },
  });

  const onFormSubmit = handleSubmit(onSubmit);

  return (
    <>
      <DocumentFlowFormContainerContent>
        <div className="flex flex-col">
          <div className="flex flex-col gap-y-4">
            <div>
              <Label htmlFor="title">
                Title<span className="text-destructive ml-1 inline-block font-medium">*</span>
              </Label>

              <Input
                id="title"
                className="bg-background mt-2"
                disabled={isSubmitting}
                {...register('title', { required: "Title can't be empty" })}
              />

              <FormErrorMessage className="mt-2" error={errors.title} />
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
          onGoBackClick={documentFlow.onBackStep}
          onGoNextClick={() => void onFormSubmit()}
        />
      </DocumentFlowFormContainerFooter>
    </>
  );
};
