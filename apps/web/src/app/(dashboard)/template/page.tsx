'use client';

import { useState } from 'react';

import { useRouter } from 'next/navigation';

import { Field, Recipient } from '@documenso/prisma/client';
import { Card, CardContent } from '@documenso/ui/primitives/card';
import { DocumentDropzone } from '@documenso/ui/primitives/document-dropzone';
import { AddTemplateFormPartial } from '@documenso/ui/primitives/document-flow/add-template-details';
import { TAddTemplateSchema } from '@documenso/ui/primitives/document-flow/add-template-details.types';
import { AddTemplateFieldsFormPartial } from '@documenso/ui/primitives/document-flow/add-template-fields';
import { TAddTemplateFieldsFormSchema } from '@documenso/ui/primitives/document-flow/add-template-fields.types';
import {
  DocumentFlowFormContainer,
  DocumentFlowFormContainerHeader,
} from '@documenso/ui/primitives/document-flow/document-flow-root';
import { DocumentFlowStep } from '@documenso/ui/primitives/document-flow/types';
import { LazyPDFViewer } from '@documenso/ui/primitives/lazy-pdf-viewer';
import { toast } from '@documenso/ui/primitives/use-toast';

type TemplatePageFlowStep = 'details' | 'fields';

export type DocumentPageProps = {
  params: {
    id: string;
  };
};

export default function TemplatePage() {
  const router = useRouter();

  const [uploadedFile, setUploadedFile] = useState<{ name: string; file: string } | null>();
  const [step, setStep] = useState<TemplatePageFlowStep>('details');
  const [fields, setFields] = useState<Field[]>([]);

  const documentFlow: Record<TemplatePageFlowStep, DocumentFlowStep> = {
    details: {
      title: 'Add Details',
      description: 'Add the name and description of your template.',
      stepIndex: 1,
      onSubmit: () => onAddTemplateDetailsFormSubmit,
    },
    fields: {
      title: 'Add Fields',
      description: 'Add all relevant fields for each recipient.',
      stepIndex: 2,
      onBackStep: () => setStep('details'),
      onSubmit: () => onAddTemplateFieldsFormSubmit,
    },
  };

  const currentDocumentFlow = documentFlow[step];

  const onAddTemplateDetailsFormSubmit = (data: TAddTemplateSchema) => {
    if (!uploadedFile) {
      return;
    }

    router.refresh();

    const templateDetails = {
      document: uploadedFile,
      ...data,
    };

    console.log(templateDetails);

    setStep('fields');
  };

  const onAddTemplateFieldsFormSubmit = (data: TAddTemplateFieldsFormSchema) => {
    if (!uploadedFile) {
      return;
    }

    console.log(data);

    console.log('Submit fields in document flow');
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

  const placeholderRecipient: Recipient[] = [
    {
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
    },
  ];

  return (
    <div className="mx-auto -mt-4 w-full max-w-screen-xl px-4 md:px-8">
      <h1 className="mt-4 max-w-xs truncate text-2xl font-semibold md:text-3xl" title="Templates">
        Templates
      </h1>

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

            {step === 'details' && (
              <fieldset disabled={!uploadedFile} className="flex h-full flex-col">
                <AddTemplateFormPartial
                  documentFlow={documentFlow.details}
                  fields={fields}
                  numberOfSteps={Object.keys(documentFlow).length}
                  onSubmit={onAddTemplateDetailsFormSubmit}
                />
              </fieldset>
            )}

            {step === 'fields' && (
              <AddTemplateFieldsFormPartial
                documentFlow={documentFlow.fields}
                recipients={placeholderRecipient}
                fields={fields}
                numberOfSteps={Object.keys(documentFlow).length}
                onSubmit={onAddTemplateFieldsFormSubmit}
              />
            )}
          </DocumentFlowFormContainer>
        </div>
      </div>
    </div>
  );
}
