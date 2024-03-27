'use client';

import { useEffect, useState } from 'react';

import { useRouter, useSearchParams } from 'next/navigation';

import {
  DO_NOT_INVALIDATE_QUERY_ON_MUTATION,
  SKIP_QUERY_BATCH_META,
} from '@documenso/lib/constants/trpc';
import { DocumentStatus } from '@documenso/prisma/client';
import type { DocumentWithDetails } from '@documenso/prisma/types/document';
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

import { useOptionalCurrentTeam } from '~/providers/team';

export type EditDocumentFormProps = {
  className?: string;
  initialDocument: DocumentWithDetails;
  documentRootPath: string;
};

type EditDocumentStep = 'title' | 'signers' | 'fields' | 'subject';
const EditDocumentSteps: EditDocumentStep[] = ['title', 'signers', 'fields', 'subject'];

export const EditDocumentForm = ({
  className,
  initialDocument,
  documentRootPath,
}: EditDocumentFormProps) => {
  const { toast } = useToast();

  const router = useRouter();
  const searchParams = useSearchParams();
  const team = useOptionalCurrentTeam();

  const [isDocumentPdfLoaded, setIsDocumentPdfLoaded] = useState(false);

  const utils = trpc.useUtils();

  const { data: document, refetch: refetchDocument } =
    trpc.document.getDocumentWithDetailsById.useQuery(
      {
        id: initialDocument.id,
        teamId: team?.id,
      },
      {
        initialData: initialDocument,
        ...SKIP_QUERY_BATCH_META,
      },
    );

  const { Recipient: recipients, Field: fields } = document;

  const { mutateAsync: addTitle } = trpc.document.setTitleForDocument.useMutation({
    ...DO_NOT_INVALIDATE_QUERY_ON_MUTATION,
    onSuccess: (newData) => {
      utils.document.getDocumentWithDetailsById.setData(
        {
          id: initialDocument.id,
          teamId: team?.id,
        },
        (oldData) => ({ ...(oldData || initialDocument), ...newData }),
      );
    },
  });

  const { mutateAsync: addFields } = trpc.field.addFields.useMutation({
    ...DO_NOT_INVALIDATE_QUERY_ON_MUTATION,
    onSuccess: (newFields) => {
      utils.document.getDocumentWithDetailsById.setData(
        {
          id: initialDocument.id,
          teamId: team?.id,
        },
        (oldData) => ({ ...(oldData || initialDocument), Field: newFields }),
      );
    },
  });

  const { mutateAsync: addSigners } = trpc.recipient.addSigners.useMutation({
    ...DO_NOT_INVALIDATE_QUERY_ON_MUTATION,
    onSuccess: (newRecipients) => {
      utils.document.getDocumentWithDetailsById.setData(
        {
          id: initialDocument.id,
          teamId: team?.id,
        },
        (oldData) => ({ ...(oldData || initialDocument), Recipient: newRecipients }),
      );
    },
  });

  const { mutateAsync: sendDocument } = trpc.document.sendDocument.useMutation({
    ...DO_NOT_INVALIDATE_QUERY_ON_MUTATION,
    onSuccess: (newData) => {
      utils.document.getDocumentWithDetailsById.setData(
        {
          id: initialDocument.id,
          teamId: team?.id,
        },
        (oldData) => ({ ...(oldData || initialDocument), ...newData }),
      );
    },
  });

  const { mutateAsync: setPasswordForDocument } =
    trpc.document.setPasswordForDocument.useMutation();

  const documentFlow: Record<EditDocumentStep, DocumentFlowStep> = {
    title: {
      title: 'Add Title',
      description: 'Add the title to the document.',
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

    let initialStep: EditDocumentStep =
      document.status === DocumentStatus.DRAFT ? 'title' : 'signers';

    if (
      searchParamStep &&
      documentFlow[searchParamStep] !== undefined &&
      !(recipients.length === 0 && (searchParamStep === 'subject' || searchParamStep === 'fields'))
    ) {
      initialStep = searchParamStep;
    }

    return initialStep;
  });

  const onAddTitleFormSubmit = async (data: TAddTitleFormSchema) => {
    try {
      await addTitle({
        documentId: document.id,
        teamId: team?.id,
        title: data.title,
      });

      // Router refresh is here to clear the router cache for when navigating to /documents.
      router.refresh();

      setStep('signers');
    } catch (err) {
      console.error(err);

      toast({
        title: 'Error',
        description: 'An error occurred while updating title.',
        variant: 'destructive',
      });
    }
  };

  const onAddSignersFormSubmit = async (data: TAddSignersFormSchema) => {
    try {
      await addSigners({
        documentId: document.id,
        teamId: team?.id,
        signers: data.signers,
      });

      // Router refresh is here to clear the router cache for when navigating to /documents.
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
      await addFields({
        documentId: document.id,
        fields: data.fields,
      });

      // Router refresh is here to clear the router cache for when navigating to /documents.
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
    const { subject, message, timezone, dateFormat, redirectUrl } = data.meta;

    try {
      await sendDocument({
        documentId: document.id,
        teamId: team?.id,
        meta: {
          subject,
          message,
          dateFormat,
          timezone,
          redirectUrl,
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

  /**
   * Refresh the data in the background when steps change.
   */
  useEffect(() => {
    void refetchDocument();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  return (
    <div className={cn('grid w-full grid-cols-12 gap-8', className)}>
      <Card
        className="relative col-span-12 rounded-xl before:rounded-xl lg:col-span-6 xl:col-span-7"
        gradient
      >
        <CardContent className="p-2">
          <LazyPDFViewer
            key={document.documentData.id}
            documentData={document.documentData}
            document={document}
            password={document.documentMeta?.password}
            onPasswordSubmit={onPasswordSubmit}
            onDocumentLoad={() => setIsDocumentPdfLoaded(true)}
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
              isDocumentPdfLoaded={isDocumentPdfLoaded}
            />
            <AddSignersFormPartial
              key={recipients.length}
              documentFlow={documentFlow.signers}
              document={document}
              recipients={recipients}
              fields={fields}
              onSubmit={onAddSignersFormSubmit}
              isDocumentPdfLoaded={isDocumentPdfLoaded}
            />
            <AddFieldsFormPartial
              key={fields.length}
              documentFlow={documentFlow.fields}
              recipients={recipients}
              fields={fields}
              onSubmit={onAddFieldsFormSubmit}
              isDocumentPdfLoaded={isDocumentPdfLoaded}
            />
            <AddSubjectFormPartial
              key={recipients.length}
              documentFlow={documentFlow.subject}
              document={document}
              recipients={recipients}
              fields={fields}
              onSubmit={onAddSubjectFormSubmit}
              isDocumentPdfLoaded={isDocumentPdfLoaded}
            />
          </Stepper>
        </DocumentFlowFormContainer>
      </div>
    </div>
  );
};
