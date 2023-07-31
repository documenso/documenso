'use client';

import { useRouter } from 'next/navigation';

import { useForm } from 'react-hook-form';

import { Document, DocumentStatus, Field, Recipient } from '@documenso/prisma/client';
import { Input } from '@documenso/ui/primitives/input';
import { Label } from '@documenso/ui/primitives/label';
import { Textarea } from '@documenso/ui/primitives/textarea';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { FormErrorMessage } from '~/components/form/form-error-message';

import { completeDocument } from './add-subject.action';
import { TAddSubjectFormSchema } from './add-subject.types';
import {
  EditDocumentFormContainer,
  EditDocumentFormContainerActions,
  EditDocumentFormContainerContent,
  EditDocumentFormContainerFooter,
  EditDocumentFormContainerStep,
} from './container';

export type AddSubjectFormProps = {
  recipients: Recipient[];
  fields: Field[];
  document: Document;
  onContinue?: () => void;
  onGoBack?: () => void;
};

export const AddSubjectFormPartial = ({
  recipients: _recipients,
  fields: _fields,
  document,
  onContinue,
  onGoBack,
}: AddSubjectFormProps) => {
  const { toast } = useToast();
  const router = useRouter();

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

  const onFormSubmit = handleSubmit(async (data: TAddSubjectFormSchema) => {
    const { subject, message } = data.email;

    try {
      await completeDocument({
        documentId: document.id,
        email: {
          subject,
          message,
        },
      });

      router.refresh();

      onContinue?.();
    } catch (err) {
      console.error(err);

      toast({
        title: 'Error',
        description: 'An error occurred while sending the document.',
        variant: 'destructive',
      });
    }
  });

  return (
    <EditDocumentFormContainer>
      <EditDocumentFormContainerContent
        title="Add Subject"
        description="Add the subject and message you wish to send to signers."
      >
        <div className="flex-col flex">
          <div className="flex-col flex gap-y-4">
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

              <ul className="flex-col mt-2 flex list-inside list-disc gap-y-2 text-sm">
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
      </EditDocumentFormContainerContent>

      <EditDocumentFormContainerFooter>
        <EditDocumentFormContainerStep title="Add Subject" step={3} maxStep={3} />

        <EditDocumentFormContainerActions
          loading={isSubmitting}
          disabled={isSubmitting}
          goNextLabel={document.status === DocumentStatus.DRAFT ? 'Send' : 'Update'}
          onGoNextClick={() => onFormSubmit()}
          onGoBackClick={onGoBack}
        />
      </EditDocumentFormContainerFooter>
    </EditDocumentFormContainer>
  );
};
