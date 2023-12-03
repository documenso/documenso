'use client';

import { useForm } from 'react-hook-form';

import type { Field, Recipient } from '@documenso/prisma/client';
import type { DocumentWithData } from '@documenso/prisma/types/document-with-data';
import { FormErrorMessage } from '@documenso/ui/primitives/form/form-error-message';
import { Input } from '@documenso/ui/primitives/input';
import { Label } from '@documenso/ui/primitives/label';

import type { StepProps } from '../stepper';
import { Step } from '../stepper';
import type { TAddTitleFormSchema } from './add-title.types';
import { DocumentFlowFormContainerContent } from './document-flow-root';

export type AddTitleFormProps = {
  recipients: Recipient[];
  fields: Field[];
  document: DocumentWithData;
  onSubmit: (_data: TAddTitleFormSchema) => void;
} & Omit<StepProps, 'children'>;

export const AddTitleFormPartial = ({
  recipients: _recipients,
  fields: _fields,
  document,
  onSubmit,
  title,
  description,
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
    <Step
      title={title}
      description={description}
      onNext={() => {
        void onFormSubmit();
      }}
      isLoading={isSubmitting}
    >
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
    </Step>
  );
};
