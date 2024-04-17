'use client';

<<<<<<< HEAD
import { useForm } from 'react-hook-form';

import { DocumentStatus, Field, Recipient } from '@documenso/prisma/client';
import { DocumentWithData } from '@documenso/prisma/types/document-with-data';
import { FormErrorMessage } from '@documenso/ui/primitives/form/form-error-message';
import { Input } from '@documenso/ui/primitives/input';
import { Label } from '@documenso/ui/primitives/label';
import { Textarea } from '@documenso/ui/primitives/textarea';

import { TAddSubjectFormSchema } from './add-subject.types';
=======
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import type { Field, Recipient } from '@documenso/prisma/client';
import { DocumentStatus } from '@documenso/prisma/client';
import type { DocumentWithData } from '@documenso/prisma/types/document-with-data';

import { FormErrorMessage } from '../form/form-error-message';
import { Input } from '../input';
import { Label } from '../label';
import { useStep } from '../stepper';
import { Textarea } from '../textarea';
import { type TAddSubjectFormSchema, ZAddSubjectFormSchema } from './add-subject.types';
>>>>>>> main
import {
  DocumentFlowFormContainerActions,
  DocumentFlowFormContainerContent,
  DocumentFlowFormContainerFooter,
<<<<<<< HEAD
  DocumentFlowFormContainerStep,
} from './document-flow-root';
import { DocumentFlowStep } from './types';
=======
  DocumentFlowFormContainerHeader,
  DocumentFlowFormContainerStep,
} from './document-flow-root';
import { ShowFieldItem } from './show-field-item';
import type { DocumentFlowStep } from './types';
>>>>>>> main

export type AddSubjectFormProps = {
  documentFlow: DocumentFlowStep;
  recipients: Recipient[];
  fields: Field[];
  document: DocumentWithData;
<<<<<<< HEAD
  numberOfSteps: number;
  onSubmit: (_data: TAddSubjectFormSchema) => void;
=======
  onSubmit: (_data: TAddSubjectFormSchema) => void;
  isDocumentPdfLoaded: boolean;
>>>>>>> main
};

export const AddSubjectFormPartial = ({
  documentFlow,
<<<<<<< HEAD
  recipients: _recipients,
  fields: _fields,
  document,
  numberOfSteps,
  onSubmit,
=======
  recipients: recipients,
  fields: fields,
  document,
  onSubmit,
  isDocumentPdfLoaded,
>>>>>>> main
}: AddSubjectFormProps) => {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<TAddSubjectFormSchema>({
    defaultValues: {
<<<<<<< HEAD
      email: {
=======
      meta: {
>>>>>>> main
        subject: document.documentMeta?.subject ?? '',
        message: document.documentMeta?.message ?? '',
      },
    },
<<<<<<< HEAD
  });

  const onFormSubmit = handleSubmit(onSubmit);

  return (
    <>
      <DocumentFlowFormContainerContent>
        <div className="flex flex-col">
=======
    resolver: zodResolver(ZAddSubjectFormSchema),
  });

  const onFormSubmit = handleSubmit(onSubmit);
  const { currentStep, totalSteps, previousStep } = useStep();

  return (
    <>
      <DocumentFlowFormContainerHeader
        title={documentFlow.title}
        description={documentFlow.description}
      />
      <DocumentFlowFormContainerContent>
        <div className="flex flex-col">
          {isDocumentPdfLoaded &&
            fields.map((field, index) => (
              <ShowFieldItem key={index} field={field} recipients={recipients} />
            ))}

>>>>>>> main
          <div className="flex flex-col gap-y-4">
            <div>
              <Label htmlFor="subject">
                Subject <span className="text-muted-foreground">(Optional)</span>
              </Label>

              <Input
                id="subject"
<<<<<<< HEAD
                // placeholder="Subject"
                className="bg-background mt-2"
                disabled={isSubmitting}
                {...register('email.subject')}
              />

              <FormErrorMessage className="mt-2" error={errors.email?.subject} />
=======
                className="bg-background mt-2"
                disabled={isSubmitting}
                {...register('meta.subject')}
              />

              <FormErrorMessage className="mt-2" error={errors.meta?.subject} />
>>>>>>> main
            </div>

            <div>
              <Label htmlFor="message">
                Message <span className="text-muted-foreground">(Optional)</span>
              </Label>

              <Textarea
                id="message"
                className="bg-background mt-2 h-32 resize-none"
                disabled={isSubmitting}
<<<<<<< HEAD
                {...register('email.message')}
=======
                {...register('meta.message')}
>>>>>>> main
              />

              <FormErrorMessage
                className="mt-2"
<<<<<<< HEAD
                error={
                  typeof errors.email?.message !== 'string' ? errors.email?.message : undefined
                }
=======
                error={typeof errors.meta?.message !== 'string' ? errors.meta?.message : undefined}
>>>>>>> main
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
          </div>
        </div>
      </DocumentFlowFormContainerContent>

      <DocumentFlowFormContainerFooter>
        <DocumentFlowFormContainerStep
          title={documentFlow.title}
<<<<<<< HEAD
          step={documentFlow.stepIndex}
          maxStep={numberOfSteps}
=======
          step={currentStep}
          maxStep={totalSteps}
>>>>>>> main
        />

        <DocumentFlowFormContainerActions
          loading={isSubmitting}
          disabled={isSubmitting}
          goNextLabel={document.status === DocumentStatus.DRAFT ? 'Send' : 'Update'}
<<<<<<< HEAD
          onGoBackClick={documentFlow.onBackStep}
=======
          onGoBackClick={previousStep}
>>>>>>> main
          onGoNextClick={() => void onFormSubmit()}
        />
      </DocumentFlowFormContainerFooter>
    </>
  );
};
