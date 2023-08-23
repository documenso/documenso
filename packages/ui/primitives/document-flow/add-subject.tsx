'use client';

import { useForm } from 'react-hook-form';

import { Document, DocumentStatus, Field, Recipient } from '@documenso/prisma/client';
import { Input } from '@documenso/ui/primitives/input';
import { Label } from '@documenso/ui/primitives/label';
import { Textarea } from '@documenso/ui/primitives/textarea';

import { FormErrorMessage } from '~/components/form/form-error-message';

import { TAddSubjectFormSchema } from './add-subject.types';
import {
  DocumentFlowFormContainer,
  DocumentFlowFormContainerActions,
  DocumentFlowFormContainerContent,
  DocumentFlowFormContainerFooter,
  DocumentFlowFormContainerStep,
} from './document-flow-root';

export type AddSubjectFormProps = {
  recipients: Recipient[];
  fields: Field[];
  document: Document;
  onContinue?: () => void;
  onGoBack?: () => void;
  onSubmit: (_data: TAddSubjectFormSchema) => void;
};

export const AddSubjectFormPartial = ({
  recipients: _recipients,
  fields: _fields,
  document,
  onGoBack,
  onSubmit,
}: AddSubjectFormProps) => {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<TAddSubjectFormSchema>({
    defaultValues: {
      email: {
        subject: '',
        message: '',
      },
    },
  });

  return (
    <DocumentFlowFormContainer>
      <DocumentFlowFormContainerContent
        title="Add Subject"
        description="Add the subject and message you wish to send to signers."
      >
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
        <DocumentFlowFormContainerStep title="Add Subject" step={3} maxStep={3} />

        <DocumentFlowFormContainerActions
          loading={isSubmitting}
          disabled={isSubmitting}
          goNextLabel={document.status === DocumentStatus.DRAFT ? 'Send' : 'Update'}
          onGoNextClick={() => handleSubmit(onSubmit)()}
          onGoBackClick={onGoBack}
        />
      </DocumentFlowFormContainerFooter>
    </DocumentFlowFormContainer>
  );
};
