'use client';

import { useState } from 'react';

import { useRouter, useSearchParams } from 'next/navigation';

import {
  type DocumentData,
  type DocumentMeta,
  type Field,
  type Recipient,
  type User,
} from '@documenso/prisma/client';
import type { DocumentWithData } from '@documenso/prisma/types/document-with-data';
import { trpc } from '@documenso/trpc/react';
import { cn } from '@documenso/ui/lib/utils';
import { Card, CardContent } from '@documenso/ui/primitives/card';
import { AddFieldsFormPartial } from '@documenso/ui/primitives/document-flow/add-fields';
import type { TAddFieldsFormSchema } from '@documenso/ui/primitives/document-flow/add-fields.types';
import { AddSettingsFormPartial } from '@documenso/ui/primitives/document-flow/add-settings';
import type { TAddSettingsFormSchema } from '@documenso/ui/primitives/document-flow/add-settings.types';
import { AddSignersFormPartial } from '@documenso/ui/primitives/document-flow/add-signers';
import type { TAddSignersFormSchema } from '@documenso/ui/primitives/document-flow/add-signers.types';
import { AddSubjectFormPartial } from '@documenso/ui/primitives/document-flow/add-subject';
import type { TAddSubjectFormSchema } from '@documenso/ui/primitives/document-flow/add-subject.types';
import { DocumentFlowFormContainer } from '@documenso/ui/primitives/document-flow/document-flow-root';
import type { DocumentFlowStep } from '@documenso/ui/primitives/document-flow/types';
import { LazyPDFViewer } from '@documenso/ui/primitives/lazy-pdf-viewer';
import { Stepper } from '@documenso/ui/primitives/stepper';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { useOptionalCurrentTeam } from '~/providers/team';

export type EditDocumentFormProps = {
  className?: string;
  user: User;
  document: DocumentWithData;
  recipients: Recipient[];
  documentMeta: DocumentMeta | null;
  fields: Field[];
  documentData: DocumentData;
  documentRootPath: string;
  isDocumentEnterprise: boolean;
};

type EditDocumentStep = 'settings' | 'signers' | 'fields' | 'subject';
const EditDocumentSteps: EditDocumentStep[] = ['settings', 'signers', 'fields', 'subject'];

export const EditDocumentForm = ({
  className,
  document,
  recipients,
  fields,
  documentMeta,
  user: _user,
  documentData,
  documentRootPath,
  isDocumentEnterprise,
}: EditDocumentFormProps) => {
  const { toast } = useToast();

  const router = useRouter();
  const searchParams = useSearchParams();
  const team = useOptionalCurrentTeam();

  const { mutateAsync: setSettingsForDocument } =
    trpc.document.setSettingsForDocument.useMutation();
  const { mutateAsync: addFields } = trpc.field.addFields.useMutation();
  const { mutateAsync: addSigners } = trpc.recipient.addSigners.useMutation();
  const { mutateAsync: sendDocument } = trpc.document.sendDocument.useMutation();
  const { mutateAsync: setPasswordForDocument } =
    trpc.document.setPasswordForDocument.useMutation();

  const documentFlow: Record<EditDocumentStep, DocumentFlowStep> = {
    settings: {
      title: 'General',
      description: 'Configure general settings for the document.',
      stepIndex: 1,
    },
    signers: {
      title: 'Add Signers',
      description: 'Add the people who will sign the document.',
      stepIndex: 2,
    },
    fields: {
      title: 'Add Fields',
      description: 'Add all relevant fields for each recipient.',
      stepIndex: 3,
    },
    subject: {
      title: 'Add Subject',
      description: 'Add the subject and message you wish to send to signers.',
      stepIndex: 4,
    },
  };

  const [step, setStep] = useState<EditDocumentStep>(() => {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const searchParamStep = searchParams?.get('step') as EditDocumentStep | undefined;

    let initialStep: EditDocumentStep = 'settings';

    if (
      searchParamStep &&
      documentFlow[searchParamStep] !== undefined &&
      !(recipients.length === 0 && (searchParamStep === 'subject' || searchParamStep === 'fields'))
    ) {
      initialStep = searchParamStep;
    }

    return initialStep;
  });

  const onAddSettingsFormSubmit = async (data: TAddSettingsFormSchema) => {
    try {
      const { timezone, dateFormat, redirectUrl } = data.meta;

      await setSettingsForDocument({
        documentId: document.id,
        teamId: team?.id,
        data: {
          title: data.title,
          globalAccessAuth: data.globalAccessAuth ?? null,
          globalActionAuth: data.globalActionAuth ?? null,
        },
        meta: {
          timezone,
          dateFormat,
          redirectUrl,
        },
      });

      router.refresh();

      setStep('signers');
    } catch (err) {
      console.error(err);

      toast({
        title: 'Error',
        description: 'An error occurred while updating the document settings.',
        variant: 'destructive',
      });
    }
  };

  const onAddSignersFormSubmit = async (data: TAddSignersFormSchema) => {
    try {
      // Custom invocation server action
      await addSigners({
        documentId: document.id,
        teamId: team?.id,
        signers: data.signers.map((signer) => ({
          ...signer,
          // Explicitly set to null to indicate we want to remove auth if required.
          actionAuth: signer.actionAuth || null,
        })),
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
    const { subject, message } = data.meta;

    try {
      await sendDocument({
        documentId: document.id,
        teamId: team?.id,
        meta: {
          subject,
          message,
        },
      });

      toast({
        title: 'Document sent',
        description: 'Your document has been sent successfully.',
        duration: 5000,
      });

      router.push(documentRootPath);
    } catch (err) {
      console.error(err);

      toast({
        title: 'Error',
        description: 'An error occurred while sending the document.',
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
            <AddSettingsFormPartial
              key={recipients.length}
              documentFlow={documentFlow.settings}
              document={document}
              recipients={recipients}
              fields={fields}
              isDocumentEnterprise={isDocumentEnterprise}
              onSubmit={onAddSettingsFormSubmit}
            />

            <AddSignersFormPartial
              key={recipients.length}
              documentFlow={documentFlow.signers}
              recipients={recipients}
              fields={fields}
              isDocumentEnterprise={isDocumentEnterprise}
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
