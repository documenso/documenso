'use client';

import { useState } from 'react';

import { useRouter } from 'next/navigation';

import { Field, Prisma, Recipient } from '@documenso/prisma/client';
import { Card, CardContent } from '@documenso/ui/primitives/card';
import { DocumentDropzone } from '@documenso/ui/primitives/document-dropzone';
import { AddFieldsFormPartial } from '@documenso/ui/primitives/document-flow/add-fields';
import { TAddFieldsFormSchema } from '@documenso/ui/primitives/document-flow/add-fields.types';
import { AddSignatureFormPartial } from '@documenso/ui/primitives/document-flow/add-signature';
import { TAddSignatureFormSchema } from '@documenso/ui/primitives/document-flow/add-signature.types';
import {
  DocumentFlowFormContainer,
  DocumentFlowFormContainerHeader,
} from '@documenso/ui/primitives/document-flow/document-flow-root';
import { DocumentFlowStep } from '@documenso/ui/primitives/document-flow/types';
import { LazyPDFViewer } from '@documenso/ui/primitives/lazy-pdf-viewer';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { createSinglePlayerDocument } from '~/components/(marketing)/single-player-mode/create-single-player-document.action';

type SinglePlayerModeStep = 'fields' | 'sign';

export default function SinglePlayerModePage() {
  const { toast } = useToast();
  const router = useRouter();

  const [uploadedFile, setUploadedFile] = useState<{ name: string; file: string } | null>();

  const [step, setStep] = useState<SinglePlayerModeStep>('fields');
  const [fields, setFields] = useState<Field[]>([]);

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
        documentId: -1,
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

    documentFlow.fields.onNextStep?.();
  };

  /**
   * Create, sign and send the document.
   */
  const onSignSubmit = async (data: TAddSignatureFormSchema) => {
    if (!uploadedFile) {
      return;
    }

    try {
      const documentToken = await createSinglePlayerDocument({
        document: uploadedFile.file,
        documentName: uploadedFile.name,
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

      router.push(`/single-player-mode/${documentToken}/success`);
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
    email: '',
    name: '',
    token: '',
    expired: null,
    signedAt: null,
    readStatus: 'OPENED',
    signingStatus: 'NOT_SIGNED',
    sendStatus: 'NOT_SENT',
  };

  const onFileDrop = async (file: File) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const base64String = Buffer.from(arrayBuffer).toString('base64');

      setUploadedFile({
        name: file.name,
        file: `data:application/pdf;base64,${base64String}`,
      });
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
        <h1 className="text-3xl font-bold lg:text-5xl">Give it a go</h1>

        <p className="mt-4 text-lg leading-normal text-[#31373D]">
          Upload a document to get started!
        </p>
      </div>

      <div className="mt-12 grid w-full grid-cols-12 gap-8">
        <div className="col-span-12 rounded-xl before:rounded-xl lg:col-span-6 xl:col-span-7">
          {uploadedFile ? (
            <Card gradient>
              <CardContent className="p-2">
                <LazyPDFViewer document={uploadedFile.file} />
              </CardContent>
            </Card>
          ) : (
            <DocumentDropzone className="h-[80vh] max-h-[60rem]" onDrop={onFileDrop} />
          )}
        </div>

        <div className="col-span-12 lg:col-span-6 xl:col-span-5">
          <DocumentFlowFormContainer onSubmit={(e) => e.preventDefault()}>
            <DocumentFlowFormContainerHeader
              title={currentDocumentFlow.title}
              description={currentDocumentFlow.description}
            />

            {/* Add fields to PDF page. */}
            {step === 'fields' && (
              <fieldset disabled={!uploadedFile} className="flex h-full flex-col">
                <AddFieldsFormPartial
                  documentFlow={documentFlow.fields}
                  hideRecipients={true}
                  recipients={uploadedFile ? [placeholderRecipient] : []}
                  numberOfSteps={Object.keys(documentFlow).length}
                  fields={fields}
                  onSubmit={onFieldsSubmit}
                />
              </fieldset>
            )}

            {/* Enter user details and signature. */}
            {step === 'sign' && (
              <AddSignatureFormPartial
                documentFlow={documentFlow.sign}
                numberOfSteps={Object.keys(documentFlow).length}
                fields={fields}
                onSubmit={onSignSubmit}
                requireName={Boolean(fields.find((field) => field.type === 'NAME'))}
                requireSignature={Boolean(fields.find((field) => field.type === 'SIGNATURE'))}
              />
            )}
          </DocumentFlowFormContainer>
        </div>
      </div>
    </div>
  );
}
