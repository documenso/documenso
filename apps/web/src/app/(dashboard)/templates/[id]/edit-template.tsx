'use client';

import { useState } from 'react';

import { useRouter } from 'next/navigation';

import {
  DocumentData,
  Template,
  TemplateField,
  TemplateRecipient,
  User,
} from '@documenso/prisma/client';
import { cn } from '@documenso/ui/lib/utils';
import { Card, CardContent } from '@documenso/ui/primitives/card';
import {
  DocumentFlowFormContainer,
  DocumentFlowFormContainerHeader,
} from '@documenso/ui/primitives/document-flow/document-flow-root';
import { DocumentFlowStep } from '@documenso/ui/primitives/document-flow/types';
import { LazyPDFViewer } from '@documenso/ui/primitives/lazy-pdf-viewer';
import { AddTemplateFieldsFormPartial } from '@documenso/ui/primitives/template-flow/add-template-fields';
import { TAddTemplateFieldsFormSchema } from '@documenso/ui/primitives/template-flow/add-template-fields.types';
import { AddTemplatePlaceholderRecipientsFormPartial } from '@documenso/ui/primitives/template-flow/add-template-placeholder-recipients';
import { TAddTemplatePlacholderRecipientsFormSchema } from '@documenso/ui/primitives/template-flow/add-template-placeholder-recipients.types';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { addTemplateFields } from '~/components/forms/edit-template/add-template-fields.action';
import { addTemplatePlaceholders } from '~/components/forms/edit-template/add-template-placeholders.action';

export type EditTemplateFormProps = {
  className?: string;
  user: User;
  template: Template;
  recipients: TemplateRecipient[];
  fields: TemplateField[];
  documentData: DocumentData;
};

type EditTemplateStep = 'signers' | 'fields';

export const EditTemplateForm = ({
  className,
  template,
  recipients,
  fields,
  user: _user,
  documentData,
}: EditTemplateFormProps) => {
  const { toast } = useToast();
  const router = useRouter();

  const [step, setStep] = useState<EditTemplateStep>('signers');

  const documentFlow: Record<EditTemplateStep, DocumentFlowStep> = {
    signers: {
      title: 'Add Placeholders',
      description: 'Add all relevant placeholders for each recipient.',
      stepIndex: 1,
    },
    fields: {
      title: 'Add Fields',
      description: 'Add all relevant fields for each recipient.',
      stepIndex: 2,
      onBackStep: () => setStep('signers'),
    },
  };

  const currentDocumentFlow = documentFlow[step];

  const onAddTemplatePlaceholderFormSubmit = async (
    data: TAddTemplatePlacholderRecipientsFormSchema,
  ) => {
    try {
      await addTemplatePlaceholders({
        templateId: template.id,
        signers: data.signers,
      });

      router.refresh();

      setStep('fields');
    } catch (err) {
      toast({
        title: 'Error',
        description: 'An error occurred while adding signers.',
        variant: 'destructive',
      });
    }
  };

  const onAddFieldsFormSubmit = async (data: TAddTemplateFieldsFormSchema) => {
    try {
      await addTemplateFields({
        templateId: template.id,
        fields: data.fields,
      });

      toast({
        title: 'Template saved',
        description: 'Your templates has been saved successfully.',
        duration: 5000,
      });

      router.push('/templates');
    } catch (err) {
      toast({
        title: 'Error',
        description: 'An error occurred while adding signers.',
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
            <AddTemplatePlaceholderRecipientsFormPartial
              key={recipients.length}
              documentFlow={documentFlow.signers}
              recipients={recipients}
              fields={fields}
              numberOfSteps={Object.keys(documentFlow).length}
              onSubmit={onAddTemplatePlaceholderFormSubmit}
            />
          )}

          {step === 'fields' && (
            <AddTemplateFieldsFormPartial
              key={fields.length}
              documentFlow={documentFlow.fields}
              recipients={recipients}
              fields={fields}
              numberOfSteps={Object.keys(documentFlow).length}
              onSubmit={onAddFieldsFormSubmit}
            />
          )}
        </DocumentFlowFormContainer>
      </div>
    </div>
  );
};
