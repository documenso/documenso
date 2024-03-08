'use client';

import { useEffect, useState } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { useAnalytics } from '@documenso/lib/client-only/hooks/use-analytics';
import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { base64 } from '@documenso/lib/universal/base64';
import { putFile } from '@documenso/lib/universal/upload/put-file';
import type { Field, Recipient } from '@documenso/prisma/client';
import { DocumentDataType, Prisma } from '@documenso/prisma/client';
import { trpc } from '@documenso/trpc/react';
import { Card, CardContent } from '@documenso/ui/primitives/card';
import { DocumentDropzone } from '@documenso/ui/primitives/document-dropzone';
import { AddFieldsFormPartial } from '@documenso/ui/primitives/document-flow/add-fields';
import type { TAddFieldsFormSchema } from '@documenso/ui/primitives/document-flow/add-fields.types';
import { AddSignatureFormPartial } from '@documenso/ui/primitives/document-flow/add-signature';
import type { TAddSignatureFormSchema } from '@documenso/ui/primitives/document-flow/add-signature.types';
import { DocumentFlowFormContainer } from '@documenso/ui/primitives/document-flow/document-flow-root';
import type { DocumentFlowStep } from '@documenso/ui/primitives/document-flow/types';
import { LazyPDFViewer } from '@documenso/ui/primitives/lazy-pdf-viewer';
import { Stepper } from '@documenso/ui/primitives/stepper';
import { useToast } from '@documenso/ui/primitives/use-toast';

const SinglePlayerModeSteps = ['fields', 'sign'] as const;
type SinglePlayerModeStep = (typeof SinglePlayerModeSteps)[number];

// !: This entire file is a hack to get around failed prerendering of
// !: the Single Player Mode page. This regression was introduced during
// !: the upgrade of Next.js to v13.5.x.
export const SinglePlayerClient = () => {
  const analytics = useAnalytics();
  const router = useRouter();

  const { toast } = useToast();

  const [uploadedFile, setUploadedFile] = useState<{ file: File; fileBase64: string } | null>();

  const [step, setStep] = useState<SinglePlayerModeStep>('fields');
  const [fields, setFields] = useState<Field[]>([]);

  const { mutateAsync: createSinglePlayerDocument } =
    trpc.singleplayer.createSinglePlayerDocument.useMutation();

  const documentFlow: Record<SinglePlayerModeStep, DocumentFlowStep> = {
    fields: {
      title: 'Add document',
      description: 'Upload a document and add fields.',
      stepIndex: 1,
      onBackStep: uploadedFile
        ? () => {
            setUploadedFile(null);
            setFields([]);
          }
        : undefined,
      onNextStep: () => setStep('sign'),
    },
    sign: {
      title: 'Sign',
      description: 'Enter your details.',
      stepIndex: 2,
      onBackStep: () => setStep('fields'),
    },
  };

  const currentDocumentFlow = documentFlow[step];

  useEffect(() => {
    analytics.startSessionRecording('marketing_session_recording_spm');

    return () => {
      analytics.stopSessionRecording();
    };
  }, [analytics]);

  /**
   * Insert the selected fields into the local state.
   */
  const onFieldsSubmit = (data: TAddFieldsFormSchema) => {
    if (!uploadedFile) {
      return;
    }

    setFields(
      data.fields.map((field, i) => ({
        id: i,
        secondaryId: i.toString(),
        documentId: -1,
        templateId: null,
        recipientId: -1,
        type: field.type,
        page: field.pageNumber,
        positionX: new Prisma.Decimal(field.pageX),
        positionY: new Prisma.Decimal(field.pageY),
        width: new Prisma.Decimal(field.pageWidth),
        height: new Prisma.Decimal(field.pageHeight),
        customText: '',
        inserted: false,
      })),
    );

    analytics.capture('Marketing: SPM - Fields added');

    documentFlow.fields.onNextStep?.();
  };

  /**
   * Upload, create, sign and send the document.
   */
  const onSignSubmit = async (data: TAddSignatureFormSchema) => {
    if (!uploadedFile) {
      return;
    }

    try {
      const putFileData = await putFile(uploadedFile.file);

      const documentToken = await createSinglePlayerDocument({
        documentData: {
          type: putFileData.type,
          data: putFileData.data,
        },
        documentName: uploadedFile.file.name,
        signer: data,
        fields: fields.map((field) => ({
          page: field.page,
          type: field.type,
          positionX: field.positionX.toNumber(),
          positionY: field.positionY.toNumber(),
          width: field.width.toNumber(),
          height: field.height.toNumber(),
        })),
      });

      analytics.capture('Marketing: SPM - Document signed', {
        signer: data.email,
      });

      router.push(`/singleplayer/${documentToken}/success`);
    } catch {
      toast({
        title: 'Something went wrong',
        description: 'Please try again later.',
        variant: 'destructive',
      });
    }
  };

  const placeholderRecipient: Recipient = {
    id: -1,
    documentId: -1,
    templateId: null,
    email: '',
    name: '',
    token: '',
    expired: null,
    signedAt: null,
    readStatus: 'OPENED',
    signingStatus: 'NOT_SIGNED',
    sendStatus: 'NOT_SENT',
    role: 'SIGNER',
  };

  const onFileDrop = async (file: File) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const fileBase64 = base64.encode(new Uint8Array(arrayBuffer));

      setUploadedFile({
        file,
        fileBase64,
      });

      analytics.capture('Marketing: SPM - Document uploaded');
    } catch {
      toast({
        title: 'Something went wrong',
        description: 'Please try again later.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="mt-6 sm:mt-12">
      <div className="text-center">
        <h1 className="text-3xl font-bold lg:text-5xl">Single Player Mode</h1>

        <p className="text-foreground mx-auto mt-4 max-w-[50ch] text-lg leading-normal">
          Create a{' '}
          <Link
            href={`${NEXT_PUBLIC_WEBAPP_URL()}/signup?utm_source=singleplayer`}
            target="_blank"
            className="hover:text-foreground/80 font-semibold transition-colors"
          >
            free account
          </Link>{' '}
          or view our{' '}
          <Link
            href={'/pricing'}
            target="_blank"
            className="hover:text-foreground/80 font-semibold transition-colors"
          >
            early adopter plan
          </Link>{' '}
          for exclusive features, including the ability to collaborate with multiple signers.
        </p>
      </div>

      <div className="mt-12 grid w-full grid-cols-12 gap-8">
        <div className="col-span-12 rounded-xl before:rounded-xl lg:col-span-6 xl:col-span-7">
          {uploadedFile ? (
            <Card gradient>
              <CardContent className="p-2">
                <LazyPDFViewer
                  documentData={{
                    id: '',
                    data: uploadedFile.fileBase64,
                    initialData: uploadedFile.fileBase64,
                    type: DocumentDataType.BYTES_64,
                  }}
                />
              </CardContent>
            </Card>
          ) : (
            <DocumentDropzone className="h-[80vh] max-h-[60rem]" onDrop={onFileDrop} />
          )}
        </div>

        <div className="col-span-12 lg:col-span-6 xl:col-span-5">
          <DocumentFlowFormContainer
            className="top-24 lg:h-[calc(100vh-7rem)]"
            onSubmit={(e) => e.preventDefault()}
          >
            <Stepper
              currentStep={currentDocumentFlow.stepIndex}
              setCurrentStep={(step) => setStep(SinglePlayerModeSteps[step - 1])}
            >
              {/* Add fields to PDF page. */}
              <fieldset disabled={!uploadedFile} className="flex h-full flex-col">
                <AddFieldsFormPartial
                  documentFlow={documentFlow.fields}
                  hideRecipients={true}
                  recipients={uploadedFile ? [placeholderRecipient] : []}
                  fields={fields}
                  onSubmit={onFieldsSubmit}
                />
              </fieldset>

              {/* Enter user details and signature. */}

              <AddSignatureFormPartial
                documentFlow={documentFlow.sign}
                fields={fields}
                onSubmit={onSignSubmit}
                requireName={Boolean(fields.find((field) => field.type === 'NAME'))}
                requireCustomText={Boolean(fields.find((field) => field.type === 'TEXT'))}
                requireSignature={Boolean(fields.find((field) => field.type === 'SIGNATURE'))}
              />
            </Stepper>
          </DocumentFlowFormContainer>
        </div>
      </div>
    </div>
  );
};
