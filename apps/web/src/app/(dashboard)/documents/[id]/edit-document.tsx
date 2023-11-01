'use client';

import { useState } from 'react';

import { useRouter } from 'next/navigation';

import { DocumentData, Field, Recipient, User } from '@documenso/prisma/client';
import { DocumentWithData } from '@documenso/prisma/types/document-with-data';
import { cn } from '@documenso/ui/lib/utils';
import { Card, CardContent } from '@documenso/ui/primitives/card';
import { AddFieldsFormPartial } from '@documenso/ui/primitives/document-flow/add-fields';
import { TAddFieldsFormSchema } from '@documenso/ui/primitives/document-flow/add-fields.types';
import { AddSignersFormPartial } from '@documenso/ui/primitives/document-flow/add-signers';
import { TAddSignersFormSchema } from '@documenso/ui/primitives/document-flow/add-signers.types';
import { AddSubjectFormPartial } from '@documenso/ui/primitives/document-flow/add-subject';
import { TAddSubjectFormSchema } from '@documenso/ui/primitives/document-flow/add-subject.types';
import {
  DocumentFlowFormContainer,
  DocumentFlowFormContainerHeader,
} from '@documenso/ui/primitives/document-flow/document-flow-root';
import { DocumentFlowStep } from '@documenso/ui/primitives/document-flow/types';
import { LazyPDFViewer } from '@documenso/ui/primitives/lazy-pdf-viewer';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { addFields } from '~/components/forms/edit-document/add-fields.action';
import { addSigners } from '~/components/forms/edit-document/add-signers.action';
import { completeDocument } from '~/components/forms/edit-document/add-subject.action';

export type EditDocumentFormProps = {
  className?: string;
  user: User;
  document: DocumentWithData;
  recipients: Recipient[];
  fields: Field[];
  documentData: DocumentData;
};

type EditDocumentStep = 'signers' | 'fields' | 'subject';

export const EditDocumentForm = ({
  className,
  document,
  recipients,
  fields,
  user: _user,
  documentData,
}: EditDocumentFormProps) => {
  const { toast } = useToast();
  const router = useRouter();

  const [step, setStep] = useState<EditDocumentStep>('signers');

  const documentFlow: Record<EditDocumentStep, DocumentFlowStep> = {
    signers: {
      title: 'Add Signers',
      description: 'Add the people who will sign the document.',
      stepIndex: 1,
    },
    fields: {
      title: 'Add Fields',
      description: 'Add all relevant fields for each recipient.',
      stepIndex: 2,
      onBackStep: () => setStep('signers'),
    },
    subject: {
      title: 'Add Subject',
      description: 'Add the subject and message you wish to send to signers.',
      stepIndex: 3,
      onBackStep: () => setStep('fields'),
    },
  };

  const currentDocumentFlow = documentFlow[step];

  const onAddSignersFormSubmit = async (data: TAddSignersFormSchema) => {
    try {
      // Custom invocation server action
      await addSigners({
        documentId: document.id,
        signers: data.signers,
      });

      router.refresh();

      setStep('fields');
    } catch (err) {
      console.error(err);

      toast({
        title: 'Error',
        description: 'An error occurred while adding signers.',
        variant: 'destructive',
      });
    }
  };

  const onAddFieldsFormSubmit = async (data: TAddFieldsFormSchema) => {
    try {
      // Custom invocation server action
      await addFields({
        documentId: document.id,
        fields: data.fields,
      });

      router.refresh();

      setStep('subject');
    } catch (err) {
      console.error(err);

      toast({
        title: 'Error',
        description: 'An error occurred while adding signers.',
        variant: 'destructive',
      });
    }
  };

  const onAddSubjectFormSubmit = async (data: TAddSubjectFormSchema) => {
    const { subject, message } = data.email;

    try {
      await completeDocument({
        documentId: document.id,
        email: {
          subject,
          message,
        },
      });

      toast({
        title: 'Document sent',
        description: 'Your document has been sent successfully.',
        duration: 5000,
      });

      router.push('/documents');
    } catch (err) {
      console.error(err);

      toast({
        title: 'Error',
        description: 'An error occurred while sending the document.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className={cn('grid w-full grid-cols-12 gap-8', className)}>
      <Card
        className="relative col-span-12 rounded-xl before:rounded-xl lg:col-span-6 xl:col-span-7"
        gradient
      >
        <CardContent className="p-2">
          <LazyPDFViewer key={documentData.id} documentData={documentData} />
        </CardContent>
      </Card>

      <div className="col-span-12 lg:col-span-6 xl:col-span-5">
        <DocumentFlowFormContainer onSubmit={(e) => e.preventDefault()}>
          <DocumentFlowFormContainerHeader
            title={currentDocumentFlow.title}
            description={currentDocumentFlow.description}
          />

          {step === 'signers' && (
            <AddSignersFormPartial
              key={recipients.length}
              documentFlow={documentFlow.signers}
              recipients={recipients}
              fields={fields}
              numberOfSteps={Object.keys(documentFlow).length}
              onSubmit={onAddSignersFormSubmit}
            />
          )}

          {step === 'fields' && (
            <AddFieldsFormPartial
              key={fields.length}
              documentFlow={documentFlow.fields}
              recipients={recipients}
              fields={fields}
              numberOfSteps={Object.keys(documentFlow).length}
              onSubmit={onAddFieldsFormSubmit}
            />
          )}

          {step === 'subject' && (
            <AddSubjectFormPartial
              documentFlow={documentFlow.subject}
              document={document}
              recipients={recipients}
              fields={fields}
              numberOfSteps={Object.keys(documentFlow).length}
              onSubmit={onAddSubjectFormSubmit}
            />
          )}
        </DocumentFlowFormContainer>
      </div>
    </div>
  );
};
