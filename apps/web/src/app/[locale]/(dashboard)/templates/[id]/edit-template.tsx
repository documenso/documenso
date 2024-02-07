'use client';

import { useState } from 'react';

import { useRouter } from 'next/navigation';

import { useTranslation } from 'react-i18next';

import type { DocumentData, Field, Recipient, Template, User } from '@documenso/prisma/client';
import { trpc } from '@documenso/trpc/react';
import { cn } from '@documenso/ui/lib/utils';
import { Card, CardContent } from '@documenso/ui/primitives/card';
import {
  DocumentFlowFormContainer,
  DocumentFlowFormContainerHeader,
} from '@documenso/ui/primitives/document-flow/document-flow-root';
import type { DocumentFlowStep } from '@documenso/ui/primitives/document-flow/types';
import { LazyPDFViewer } from '@documenso/ui/primitives/lazy-pdf-viewer';
import { Stepper } from '@documenso/ui/primitives/stepper';
import { AddTemplateFieldsFormPartial } from '@documenso/ui/primitives/template-flow/add-template-fields';
import type { TAddTemplateFieldsFormSchema } from '@documenso/ui/primitives/template-flow/add-template-fields.types';
import { AddTemplatePlaceholderRecipientsFormPartial } from '@documenso/ui/primitives/template-flow/add-template-placeholder-recipients';
import type { TAddTemplatePlacholderRecipientsFormSchema } from '@documenso/ui/primitives/template-flow/add-template-placeholder-recipients.types';
import { useToast } from '@documenso/ui/primitives/use-toast';

export type EditTemplateFormProps = {
  className?: string;
  user: User;
  template: Template;
  recipients: Recipient[];
  fields: Field[];
  documentData: DocumentData;
};

type EditTemplateStep = 'signers' | 'fields';
const EditTemplateSteps: EditTemplateStep[] = ['signers', 'fields'];

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
  const { t } = useTranslation();

  const [step, setStep] = useState<EditTemplateStep>('signers');

  const documentFlow: Record<EditTemplateStep, DocumentFlowStep> = {
    signers: {
      title: `${t('add_placeholders')}`,
      description: `${t('add_all_relevent_placeholders')}`,
      stepIndex: 1,
    },
    fields: {
      title: `${t('add_fileds')}`,
      description: `${t('add_all_relevant_fields')}`,
      stepIndex: 2,
    },
  };

  const currentDocumentFlow = documentFlow[step];

  const { mutateAsync: addTemplateFields } = trpc.field.addTemplateFields.useMutation();
  const { mutateAsync: addTemplateSigners } = trpc.recipient.addTemplateSigners.useMutation();

  const onAddTemplatePlaceholderFormSubmit = async (
    data: TAddTemplatePlacholderRecipientsFormSchema,
  ) => {
    try {
      await addTemplateSigners({
        templateId: template.id,
        signers: data.signers,
      });

      router.refresh();

      setStep('fields');
    } catch (err) {
      toast({
        title: `${t('error')}`,
        description: `${t('error_occured_while_adding_signers')}`,
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
        title: `${t('template_saved')}`,
        description: `${t('templates_has_been_saved_successfully')}`,
        duration: 5000,
      });

      router.push('/templates');
    } catch (err) {
      toast({
        title: `${t('error')}`,
        description: `${t('error_occured_while_adding_signers')}`,
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
        <DocumentFlowFormContainer
          className="lg:h-[calc(100vh-6rem)]"
          onSubmit={(e) => e.preventDefault()}
        >
          <DocumentFlowFormContainerHeader
            title={currentDocumentFlow.title}
            description={currentDocumentFlow.description}
          />

          <Stepper
            currentStep={currentDocumentFlow.stepIndex}
            setCurrentStep={(step) => setStep(EditTemplateSteps[step - 1])}
          >
            <AddTemplatePlaceholderRecipientsFormPartial
              key={recipients.length}
              documentFlow={documentFlow.signers}
              recipients={recipients}
              fields={fields}
              onSubmit={onAddTemplatePlaceholderFormSubmit}
            />

            <AddTemplateFieldsFormPartial
              key={fields.length}
              documentFlow={documentFlow.fields}
              recipients={recipients}
              fields={fields}
              onSubmit={onAddFieldsFormSubmit}
            />
          </Stepper>
        </DocumentFlowFormContainer>
      </div>
    </div>
  );
};
