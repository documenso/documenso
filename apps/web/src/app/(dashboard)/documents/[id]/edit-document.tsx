'use client';

import { useEffect, useState } from 'react';

import { useRouter, useSearchParams } from 'next/navigation';

import { msg } from '@lingui/macro';
import { useLingui } from '@lingui/react';

import { isValidLanguageCode } from '@documenso/lib/constants/i18n';
import {
  DO_NOT_INVALIDATE_QUERY_ON_MUTATION,
  SKIP_QUERY_BATCH_META,
} from '@documenso/lib/constants/trpc';
import type { DocumentWithDetails } from '@documenso/prisma/types/document';
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
  initialDocument: DocumentWithDetails;
  documentRootPath: string;
  isDocumentEnterprise: boolean;
};

type EditDocumentStep = 'settings' | 'signers' | 'fields' | 'subject';
const EditDocumentSteps: EditDocumentStep[] = ['settings', 'signers', 'fields', 'subject'];

export const EditDocumentForm = ({
  className,
  initialDocument,
  documentRootPath,
  isDocumentEnterprise,
}: EditDocumentFormProps) => {
  const { toast } = useToast();
  const { _ } = useLingui();

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

  const { mutateAsync: setSettingsForDocument } = trpc.document.setSettingsForDocument.useMutation({
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

  const { mutateAsync: setSigningOrderForDocument } =
    trpc.document.setSigningOrderForDocument.useMutation({
      ...DO_NOT_INVALIDATE_QUERY_ON_MUTATION,
      onSuccess: (newData) => {
        utils.document.getDocumentWithDetailsById.setData(
          {
            id: initialDocument.id,
            teamId: team?.id,
          },
          (oldData) => ({ ...(oldData || initialDocument), ...newData, id: Number(newData.id) }),
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

  const { mutateAsync: updateTypedSignature } =
    trpc.document.updateTypedSignatureSettings.useMutation({
      ...DO_NOT_INVALIDATE_QUERY_ON_MUTATION,
      onSuccess: (newData) => {
        utils.document.getDocumentWithDetailsById.setData(
          {
            id: initialDocument.id,
            teamId: team?.id,
          },
          (oldData) => ({
            ...(oldData || initialDocument),
            ...newData,
            id: Number(newData.id),
          }),
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
    settings: {
      title: msg`General`,
      description: msg`Configure general settings for the document.`,
      stepIndex: 1,
    },
    signers: {
      title: msg`Add Signers`,
      description: msg`Add the people who will sign the document.`,
      stepIndex: 2,
    },
    fields: {
      title: msg`Add Fields`,
      description: msg`Add all relevant fields for each recipient.`,
      stepIndex: 3,
    },
    subject: {
      title: msg`Add Subject`,
      description: msg`Add the subject and message you wish to send to signers.`,
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
      const { timezone, dateFormat, redirectUrl, language } = data.meta;

      await setSettingsForDocument({
        documentId: document.id,
        teamId: team?.id,
        data: {
          title: data.title,
          externalId: data.externalId || null,
          visibility: data.visibility,
          globalAccessAuth: data.globalAccessAuth ?? null,
          globalActionAuth: data.globalActionAuth ?? null,
        },
        meta: {
          timezone,
          dateFormat,
          redirectUrl,
          language: isValidLanguageCode(language) ? language : undefined,
        },
      });

      // Router refresh is here to clear the router cache for when navigating to /documents.
      router.refresh();

      setStep('signers');
    } catch (err) {
      console.error(err);

      toast({
        title: _(msg`Error`),
        description: _(msg`An error occurred while updating the document settings.`),
        variant: 'destructive',
      });
    }
  };

  const onAddSignersFormSubmit = async (data: TAddSignersFormSchema) => {
    try {
      await Promise.all([
        setSigningOrderForDocument({
          documentId: document.id,
          signingOrder: data.signingOrder,
        }),

        addSigners({
          documentId: document.id,
          teamId: team?.id,
          signers: data.signers.map((signer) => ({
            ...signer,
            // Explicitly set to null to indicate we want to remove auth if required.
            actionAuth: signer.actionAuth || null,
          })),
        }),
      ]);

      // Router refresh is here to clear the router cache for when navigating to /documents.
      router.refresh();

      setStep('fields');
    } catch (err) {
      console.error(err);

      toast({
        title: _(msg`Error`),
        description: _(msg`An error occurred while adding signers.`),
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

      await updateTypedSignature({
        documentId: document.id,
        typedSignatureEnabled: data.typedSignatureEnabled,
      });

      // Clear all field data from localStorage
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('field_')) {
          localStorage.removeItem(key);
        }
      }

      // Router refresh is here to clear the router cache for when navigating to /documents.
      router.refresh();

      setStep('subject');
    } catch (err) {
      console.error(err);

      toast({
        title: _(msg`Error`),
        description: _(msg`An error occurred while adding the fields.`),
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
        title: _(msg`Document sent`),
        description: _(msg`Your document has been sent successfully.`),
        duration: 5000,
      });

      router.push(documentRootPath);
    } catch (err) {
      console.error(err);

      toast({
        title: _(msg`Error`),
        description: _(msg`An error occurred while sending the document.`),
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
            <AddSettingsFormPartial
              key={recipients.length}
              documentFlow={documentFlow.settings}
              document={document}
              currentTeamMemberRole={team?.currentTeamMember?.role}
              recipients={recipients}
              fields={fields}
              isDocumentEnterprise={isDocumentEnterprise}
              isDocumentPdfLoaded={isDocumentPdfLoaded}
              onSubmit={onAddSettingsFormSubmit}
            />

            <AddSignersFormPartial
              key={recipients.length}
              documentFlow={documentFlow.signers}
              recipients={recipients}
              signingOrder={document.documentMeta?.signingOrder}
              fields={fields}
              isDocumentEnterprise={isDocumentEnterprise}
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
              typedSignatureEnabled={document.documentMeta?.typedSignatureEnabled}
              teamId={team?.id}
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
