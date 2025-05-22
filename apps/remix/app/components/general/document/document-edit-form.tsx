import { useEffect, useState } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { DocumentDistributionMethod, DocumentStatus } from '@prisma/client';
import { useNavigate, useSearchParams } from 'react-router';

import { DocumentSignatureType } from '@documenso/lib/constants/document';
import { isValidLanguageCode } from '@documenso/lib/constants/i18n';
import {
  DO_NOT_INVALIDATE_QUERY_ON_MUTATION,
  SKIP_QUERY_BATCH_META,
} from '@documenso/lib/constants/trpc';
import type { TDocument } from '@documenso/lib/types/document';
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
import { PDFViewer } from '@documenso/ui/primitives/pdf-viewer';
import { Stepper } from '@documenso/ui/primitives/stepper';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { useCurrentTeam } from '~/providers/team';

export type DocumentEditFormProps = {
  className?: string;
  initialDocument: TDocument;
  documentRootPath: string;
};

type EditDocumentStep = 'settings' | 'signers' | 'fields' | 'subject';
const EditDocumentSteps: EditDocumentStep[] = ['settings', 'signers', 'fields', 'subject'];

export const DocumentEditForm = ({
  className,
  initialDocument,
  documentRootPath,
}: DocumentEditFormProps) => {
  const { toast } = useToast();
  const { _ } = useLingui();

  const navigate = useNavigate();

  const [searchParams] = useSearchParams();
  const team = useCurrentTeam();

  const [isDocumentPdfLoaded, setIsDocumentPdfLoaded] = useState(false);

  const utils = trpc.useUtils();

  const { data: document, refetch: refetchDocument } =
    trpc.document.getDocumentWithDetailsById.useQuery(
      {
        documentId: initialDocument.id,
      },
      {
        initialData: initialDocument,
        ...SKIP_QUERY_BATCH_META,
      },
    );

  const { recipients, fields } = document;

  const { mutateAsync: updateDocument } = trpc.document.updateDocument.useMutation({
    ...DO_NOT_INVALIDATE_QUERY_ON_MUTATION,
    onSuccess: (newData) => {
      utils.document.getDocumentWithDetailsById.setData(
        {
          documentId: initialDocument.id,
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
            documentId: initialDocument.id,
          },
          (oldData) => ({ ...(oldData || initialDocument), ...newData, id: Number(newData.id) }),
        );
      },
    });

  const { mutateAsync: addFields } = trpc.field.addFields.useMutation({
    ...DO_NOT_INVALIDATE_QUERY_ON_MUTATION,
    onSuccess: ({ fields: newFields }) => {
      utils.document.getDocumentWithDetailsById.setData(
        {
          documentId: initialDocument.id,
        },
        (oldData) => ({ ...(oldData || initialDocument), fields: newFields }),
      );
    },
  });

  const { mutateAsync: setRecipients } = trpc.recipient.setDocumentRecipients.useMutation({
    ...DO_NOT_INVALIDATE_QUERY_ON_MUTATION,
    onSuccess: ({ recipients: newRecipients }) => {
      utils.document.getDocumentWithDetailsById.setData(
        {
          documentId: initialDocument.id,
        },
        (oldData) => ({ ...(oldData || initialDocument), recipients: newRecipients }),
      );
    },
  });

  const { mutateAsync: sendDocument } = trpc.document.sendDocument.useMutation({
    ...DO_NOT_INVALIDATE_QUERY_ON_MUTATION,
    onSuccess: (newData) => {
      utils.document.getDocumentWithDetailsById.setData(
        {
          documentId: initialDocument.id,
        },
        (oldData) => ({ ...(oldData || initialDocument), ...newData }),
      );
    },
  });

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
      title: msg`Distribute Document`,
      description: msg`Choose how the document will reach recipients`,
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
      const { timezone, dateFormat, redirectUrl, language, signatureTypes } = data.meta;

      await updateDocument({
        documentId: document.id,
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
          typedSignatureEnabled: signatureTypes.includes(DocumentSignatureType.TYPE),
          uploadSignatureEnabled: signatureTypes.includes(DocumentSignatureType.UPLOAD),
          drawSignatureEnabled: signatureTypes.includes(DocumentSignatureType.DRAW),
        },
      });

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

        updateDocument({
          documentId: document.id,
          meta: {
            allowDictateNextSigner: data.allowDictateNextSigner,
          },
        }),

        setRecipients({
          documentId: document.id,
          recipients: data.signers.map((signer) => ({
            ...signer,
            // Explicitly set to null to indicate we want to remove auth if required.
            actionAuth: signer.actionAuth || null,
          })),
        }),
      ]);

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

      // Clear all field data from localStorage
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('field_')) {
          localStorage.removeItem(key);
        }
      }

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
    const { subject, message, distributionMethod, emailSettings } = data.meta;

    try {
      await sendDocument({
        documentId: document.id,
        meta: {
          subject,
          message,
          distributionMethod,
          emailSettings,
        },
      });

      if (distributionMethod === DocumentDistributionMethod.EMAIL) {
        toast({
          title: _(msg`Document sent`),
          description: _(msg`Your document has been sent successfully.`),
          duration: 5000,
        });

        await navigate(documentRootPath);
      } else if (document.status === DocumentStatus.DRAFT) {
        toast({
          title: _(msg`Links Generated`),
          description: _(msg`Signing links have been generated for this document.`),
          duration: 5000,
        });
      } else {
        await navigate(`${documentRootPath}/${document.id}`);
      }
    } catch (err) {
      console.error(err);

      toast({
        title: _(msg`Error`),
        description: _(msg`An error occurred while sending the document.`),
        variant: 'destructive',
      });
    }
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
          <PDFViewer
            key={document.documentData.id}
            documentData={document.documentData}
            document={document}
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
              currentTeamMemberRole={team.currentTeamRole}
              recipients={recipients}
              fields={fields}
              isDocumentPdfLoaded={isDocumentPdfLoaded}
              onSubmit={onAddSettingsFormSubmit}
            />

            <AddSignersFormPartial
              key={recipients.length}
              documentFlow={documentFlow.signers}
              recipients={recipients}
              signingOrder={document.documentMeta?.signingOrder}
              allowDictateNextSigner={document.documentMeta?.allowDictateNextSigner}
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
              teamId={team.id}
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
