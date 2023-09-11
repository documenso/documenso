'use client';

import React from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { Field } from '@documenso/prisma/client';
import { FormErrorMessage } from '@documenso/ui/primitives/form/form-error-message';
import { Input } from '@documenso/ui/primitives/input';
import { Label } from '@documenso/ui/primitives/label';

import { TAddTemplateSchema, ZAddTemplateSchema } from './add-template-details.types';
import {
  DocumentFlowFormContainerActions,
  DocumentFlowFormContainerContent,
  DocumentFlowFormContainerFooter,
  DocumentFlowFormContainerStep,
} from './document-flow-root';
import { DocumentFlowStep } from './types';

export type AddTemplateFormProps = {
  documentFlow: DocumentFlowStep;
  fields: Field[];
  numberOfSteps: number;
  onSubmit: (_data: TAddTemplateSchema) => void;
};

export const AddTemplateFormPartial = ({
  documentFlow,
  numberOfSteps,
  fields: _fields,
  onSubmit,
}: AddTemplateFormProps) => {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<TAddTemplateSchema>({
    resolver: zodResolver(ZAddTemplateSchema),
    defaultValues: {
      template: {
        name: '',
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
              <Label htmlFor="name">Name</Label>

              <Input
                id="name"
                className="bg-background mt-2"
                disabled={isSubmitting}
                {...register('template.name')}
              />

              <FormErrorMessage className="mt-2" error={errors.template?.name} />
            </div>

            <div>
              <Label htmlFor="description">
                Description <span className="text-muted-foreground">(Optional)</span>
              </Label>

              <Input
                id="description"
                className="bg-background mt-2"
                disabled={isSubmitting}
                {...register('template.description')}
              />

              <FormErrorMessage className="mt-2" error={errors.template?.description} />
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
