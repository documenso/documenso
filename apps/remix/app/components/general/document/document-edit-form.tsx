import { useEffect, useState } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { DocumentDistributionMethod, DocumentStatus } from '@prisma/client';
import { useNavigate, useSearchParams } from 'react-router';
import { z } from 'zod';

import { DocumentSignatureType } from '@documenso/lib/constants/document';
import { isValidLanguageCode } from '@documenso/lib/constants/i18n';
import {
  DO_NOT_INVALIDATE_QUERY_ON_MUTATION,
  SKIP_QUERY_BATCH_META,
} from '@documenso/lib/constants/trpc';
import type { TDocument } from '@documenso/lib/types/document';
import { ZDocumentAccessAuthTypesSchema } from '@documenso/lib/types/document-auth';
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
import { PDFViewerLazy } from '@documenso/ui/primitives/pdf-viewer/lazy';
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

  const { data: document, refetch: refetchDocument } = trpc.document.get.useQuery(
    {
      documentId: initialDocument.id,
    },
    {
      initialData: initialDocument,
      ...SKIP_QUERY_BATCH_META,
    },
  );

  const { recipients, fields } = document;

  const { mutateAsync: updateDocument } = trpc.document.update.useMutation({
    ...DO_NOT_INVALIDATE_QUERY_ON_MUTATION,
    onSuccess: (newData) => {
      utils.document.get.setData(
        {
          documentId: initialDocument.id,
        },
        (oldData) => ({ ...(oldData || initialDocument), ...newData }),
      );
    },
  });

  const { mutateAsync: addFields } = trpc.field.setFieldsForDocument.useMutation({
    ...DO_NOT_INVALIDATE_QUERY_ON_MUTATION,
    onSuccess: ({ fields: newFields }) => {
      utils.document.get.setData(
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
      utils.document.get.setData(
        {
          documentId: initialDocument.id,
        },
        (oldData) => ({ ...(oldData || initialDocument), recipients: newRecipients }),
      );
    },
  });

  const { mutateAsync: sendDocument } = trpc.document.distribute.useMutation({
    ...DO_NOT_INVALIDATE_QUERY_ON_MUTATION,
    onSuccess: (newData) => {
      utils.document.get.setData(
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

  const saveSettingsData = async (data: TAddSettingsFormSchema) => {
    const { timezone, dateFormat, redirectUrl, language, signatureTypes } = data.meta;

    const parsedGlobalAccessAuth = z
      .array(ZDocumentAccessAuthTypesSchema)
      .safeParse(data.globalAccessAuth);

    return updateDocument({
      documentId: document.id,
      data: {
        title: data.title,
        externalId: data.externalId || null,
        visibility: data.visibility,
        globalAccessAuth: parsedGlobalAccessAuth.success ? parsedGlobalAccessAuth.data : [],
        globalActionAuth: data.globalActionAuth ?? [],
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
  };

  const onAddSettingsFormSubmit = async (data: TAddSettingsFormSchema) => {
    try {
      await saveSettingsData(data);
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

  const onAddSettingsFormAutoSave = async (data: TAddSettingsFormSchema) => {
    try {
      await saveSettingsData(data);
    } catch (err) {
      console.error(err);

      toast({
        title: _(msg`Error`),
        description: _(msg`An error occurred while auto-saving the document settings.`),
        variant: 'destructive',
      });
    }
  };

  const saveSignersData = async (data: TAddSignersFormSchema) => {
    return Promise.all([
      updateDocument({
        documentId: document.id,
        meta: {
          allowDictateNextSigner: data.allowDictateNextSigner,
          signingOrder: data.signingOrder,
        },
      }),

      setRecipients({
        documentId: document.id,
        recipients: data.signers.map((signer) => ({
          ...signer,
          id: signer.nativeId,
          // Explicitly set to null to indicate we want to remove auth if required.
          actionAuth: signer.actionAuth ?? [],
        })),
      }),
    ]);
  };

  const onAddSignersFormAutoSave = async (data: TAddSignersFormSchema) => {
    try {
      // For autosave, we need to return the recipients response for form state sync
      const [, recipientsResponse] = await Promise.all([
        updateDocument({
          documentId: document.id,
          meta: {
            allowDictateNextSigner: data.allowDictateNextSigner,
            signingOrder: data.signingOrder,
          },
        }),

        setRecipients({
          documentId: document.id,
          recipients: data.signers.map((signer) => ({
            ...signer,
            id: signer.nativeId,
            // Explicitly set to null to indicate we want to remove auth if required.
            actionAuth: signer.actionAuth ?? [],
          })),
        }),
      ]);

      return recipientsResponse;
    } catch (err) {
      console.error(err);

      toast({
        title: _(msg`Error`),
        description: _(msg`An error occurred while adding signers.`),
        variant: 'destructive',
      });

      throw err; // Re-throw so the autosave hook can handle the error
    }
  };

  const onAddSignersFormSubmit = async (data: TAddSignersFormSchema) => {
    try {
      await saveSignersData(data);

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

  const saveFieldsData = async (data: TAddFieldsFormSchema) => {
    return addFields({
      documentId: document.id,
      fields: data.fields.map((field) => ({
        ...field,
        id: field.nativeId,
        envelopeItemId: document.documentData.envelopeItemId,
      })),
    });
  };

  const onAddFieldsFormSubmit = async (data: TAddFieldsFormSchema) => {
    try {
      await saveFieldsData(data);

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

  const onAddFieldsFormAutoSave = async (data: TAddFieldsFormSchema) => {
    try {
      await saveFieldsData(data);
      // Don't clear localStorage on auto-save, only on explicit submit
    } catch (err) {
      console.error(err);

      toast({
        title: _(msg`Error`),
        description: _(msg`An error occurred while auto-saving the fields.`),
        variant: 'destructive',
      });
    }
  };

  const saveSubjectData = async (data: TAddSubjectFormSchema) => {
    const { subject, message, distributionMethod, emailId, emailReplyTo, emailSettings } =
      data.meta;

    return updateDocument({
      documentId: document.id,
      meta: {
        subject,
        message,
        distributionMethod,
        emailId,
        emailReplyTo,
        emailSettings: emailSettings,
      },
    });
  };

  const sendDocumentWithSubject = async (data: TAddSubjectFormSchema) => {
    const { subject, message, distributionMethod, emailId, emailReplyTo, emailSettings } =
      data.meta;

    return sendDocument({
      documentId: document.id,
      meta: {
        subject,
        message,
        distributionMethod,
        emailId,
        emailReplyTo: emailReplyTo || null,
        emailSettings,
      },
    });
  };

  const onAddSubjectFormSubmit = async (data: TAddSubjectFormSchema) => {
    try {
      await sendDocumentWithSubject(data);

      if (data.meta.distributionMethod === DocumentDistributionMethod.EMAIL) {
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
        await navigate(`${documentRootPath}/${document.envelopeId}`);
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

  const onAddSubjectFormAutoSave = async (data: TAddSubjectFormSchema) => {
    try {
      // Save form data without sending the document
      await saveSubjectData(data);
    } catch (err) {
      console.error(err);

      toast({
        title: _(msg`Error`),
        description: _(msg`An error occurred while auto-saving the subject form.`),
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
          <PDFViewerLazy
            key={document.envelopeItems[0].id}
            envelopeItem={document.envelopeItems[0]}
            token={undefined}
            version="signed"
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
              onAutoSave={onAddSettingsFormAutoSave}
            />

            <AddSignersFormPartial
              key={document.id}
              documentFlow={documentFlow.signers}
              recipients={recipients}
              signingOrder={document.documentMeta?.signingOrder}
              allowDictateNextSigner={document.documentMeta?.allowDictateNextSigner}
              fields={fields}
              onSubmit={onAddSignersFormSubmit}
              onAutoSave={onAddSignersFormAutoSave}
              isDocumentPdfLoaded={isDocumentPdfLoaded}
            />

            <AddFieldsFormPartial
              key={document.id}
              documentFlow={documentFlow.fields}
              recipients={recipients}
              fields={fields}
              onSubmit={onAddFieldsFormSubmit}
              onAutoSave={onAddFieldsFormAutoSave}
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
              onAutoSave={onAddSubjectFormAutoSave}
              isDocumentPdfLoaded={isDocumentPdfLoaded}
            />
          </Stepper>
        </DocumentFlowFormContainer>
      </div>
    </div>
  );
};
