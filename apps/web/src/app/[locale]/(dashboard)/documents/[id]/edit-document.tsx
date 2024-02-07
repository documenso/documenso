'use client';

import { useState } from 'react';

import { useRouter } from 'next/navigation';

import { useTranslation } from 'react-i18next';

import type { DocumentData, DocumentMeta, Field, Recipient, User } from '@documenso/prisma/client';
import { DocumentStatus } from '@documenso/prisma/client';
import type { DocumentWithData } from '@documenso/prisma/types/document-with-data';
import { trpc } from '@documenso/trpc/react';
import { cn } from '@documenso/ui/lib/utils';
import { Card, CardContent } from '@documenso/ui/primitives/card';
import { AddFieldsFormPartial } from '@documenso/ui/primitives/document-flow/add-fields';
import type { TAddFieldsFormSchema } from '@documenso/ui/primitives/document-flow/add-fields.types';
import { AddSignersFormPartial } from '@documenso/ui/primitives/document-flow/add-signers';
import type { TAddSignersFormSchema } from '@documenso/ui/primitives/document-flow/add-signers.types';
import { AddSubjectFormPartial } from '@documenso/ui/primitives/document-flow/add-subject';
import type { TAddSubjectFormSchema } from '@documenso/ui/primitives/document-flow/add-subject.types';
import { AddTitleFormPartial } from '@documenso/ui/primitives/document-flow/add-title';
import type { TAddTitleFormSchema } from '@documenso/ui/primitives/document-flow/add-title.types';
import { DocumentFlowFormContainer } from '@documenso/ui/primitives/document-flow/document-flow-root';
import type { DocumentFlowStep } from '@documenso/ui/primitives/document-flow/types';
import { LazyPDFViewer } from '@documenso/ui/primitives/lazy-pdf-viewer';
import { Stepper } from '@documenso/ui/primitives/stepper';
import { useToast } from '@documenso/ui/primitives/use-toast';

export type EditDocumentFormProps = {
  className?: string;
  user: User;
  document: DocumentWithData;
  recipients: Recipient[];
  documentMeta: DocumentMeta | null;
  fields: Field[];
  documentData: DocumentData;
};

type EditDocumentStep = 'title' | 'signers' | 'fields' | 'subject';
const EditDocumentSteps: EditDocumentStep[] = ['title', 'signers', 'fields', 'subject'];

export const EditDocumentForm = ({
  className,
  document,
  recipients,
  fields,
  documentMeta,
  user: _user,
  documentData,
}: EditDocumentFormProps) => {
  const { toast } = useToast();
  const router = useRouter();
  const { t } = useTranslation();

  // controlled stepper state
  const [step, setStep] = useState<EditDocumentStep>(
    document.status === DocumentStatus.DRAFT ? 'title' : 'signers',
  );

  const { mutateAsync: addTitle } = trpc.document.setTitleForDocument.useMutation();
  const { mutateAsync: addFields } = trpc.field.addFields.useMutation();
  const { mutateAsync: addSigners } = trpc.recipient.addSigners.useMutation();
  const { mutateAsync: sendDocument } = trpc.document.sendDocument.useMutation();
  const { mutateAsync: setPasswordForDocument } =
    trpc.document.setPasswordForDocument.useMutation();

  const documentFlow: Record<EditDocumentStep, DocumentFlowStep> = {
    title: {
      title: `${t('add_title')}`,
      description: `${t('add_title_to_the_document')}`,
      stepIndex: 1,
    },
    signers: {
      title: `${t('add_signers')}`,
      description: `${t('add_people_who_will_sign')}`,
      stepIndex: 2,
    },
    fields: {
      title: `${t('add_fileds')}`,
      description: `${t('add_all_relevant_fields')}`,
      stepIndex: 3,
    },
    subject: {
      title: `${t('add_subject')}`,
      description: `${t('add_subject_and_message')}`,
      stepIndex: 4,
    },
  };

  const onAddTitleFormSubmit = async (data: TAddTitleFormSchema) => {
    try {
      // Custom invocation server action
      await addTitle({
        documentId: document.id,
        title: data.title,
      });

      router.refresh();

      setStep('signers');
    } catch (err) {
      console.error(err);

      toast({
        title: `${t('error')}`,
        description: `${t('error_occured_while_updating_title')}`,
        variant: 'destructive',
      });
    }
  };

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
        title: `${t('error')}`,
        description: `${t('error_occured_while_adding_signers')}`,
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
        title: `${t('error')}`,
        description: `${t('error_occured_while_adding_signers')}`,
        variant: 'destructive',
      });
    }
  };

  const onAddSubjectFormSubmit = async (data: TAddSubjectFormSchema) => {
    const { subject, message, timezone, dateFormat } = data.meta;

    try {
      await sendDocument({
        documentId: document.id,
        meta: {
          subject,
          message,
          timezone,
          dateFormat,
        },
      });

      toast({
        title: `${t('document_sent')}`,
        description: `${t('document_sent_successfully')}`,
        duration: 5000,
      });

      router.push('/documents');
    } catch (err) {
      console.error(err);

      toast({
        title: `${t('error')}`,
        description: `${t('error_occured_while_sending_document')}`,
        variant: 'destructive',
      });
    }
  };

  const onPasswordSubmit = async (password: string) => {
    await setPasswordForDocument({
      documentId: document.id,
      password,
    });
  };

  const currentDocumentFlow = documentFlow[step];

  return (
    <div className={cn('grid w-full grid-cols-12 gap-8', className)}>
      <Card
        className="relative col-span-12 rounded-xl before:rounded-xl lg:col-span-6 xl:col-span-7"
        gradient
      >
        <CardContent className="p-2">
          <LazyPDFViewer
            key={documentData.id}
            documentData={documentData}
            document={document}
            password={documentMeta?.password}
            onPasswordSubmit={onPasswordSubmit}
          />
        </CardContent>
      </Card>

      <div className="col-span-12 lg:col-span-6 xl:col-span-5">
        <DocumentFlowFormContainer
          className="lg:h-[calc(100vh-6rem)]"
          onSubmit={(e) => e.preventDefault()}
        >
          <Stepper
            currentStep={currentDocumentFlow.stepIndex}
            setCurrentStep={(step) => setStep(EditDocumentSteps[step - 1])}
          >
            <AddTitleFormPartial
              key={recipients.length}
              documentFlow={documentFlow.title}
              document={document}
              recipients={recipients}
              fields={fields}
              onSubmit={onAddTitleFormSubmit}
            />

            <AddSignersFormPartial
              key={recipients.length}
              documentFlow={documentFlow.signers}
              document={document}
              recipients={recipients}
              fields={fields}
              onSubmit={onAddSignersFormSubmit}
            />
            <AddFieldsFormPartial
              key={fields.length}
              documentFlow={documentFlow.fields}
              recipients={recipients}
              fields={fields}
              onSubmit={onAddFieldsFormSubmit}
            />
            <AddSubjectFormPartial
              key={recipients.length}
              documentFlow={documentFlow.subject}
              document={document}
              recipients={recipients}
              fields={fields}
              onSubmit={onAddSubjectFormSubmit}
            />
          </Stepper>
        </DocumentFlowFormContainer>
      </div>
    </div>
  );
};
