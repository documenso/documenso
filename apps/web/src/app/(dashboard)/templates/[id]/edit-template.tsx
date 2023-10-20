'use client';

import { useState } from 'react';

import { useRouter } from 'next/navigation';

import { Template, TemplateField, TemplateRecipient, User } from '@documenso/prisma/client';
import { cn } from '@documenso/ui/lib/utils';
import { Card, CardContent } from '@documenso/ui/primitives/card';
import { AddTemplatePlaceholderRecipientsFormPartial } from '@documenso/ui/primitives/document-flow/add-template-placeholder-recipients';
import { TAddTemplatePlacholderRecipientsFormSchema } from '@documenso/ui/primitives/document-flow/add-template-placeholder-recipients.types';
import {
  DocumentFlowFormContainer,
  DocumentFlowFormContainerHeader,
} from '@documenso/ui/primitives/document-flow/document-flow-root';
import { DocumentFlowStep } from '@documenso/ui/primitives/document-flow/types';
import { LazyPDFViewer } from '@documenso/ui/primitives/lazy-pdf-viewer';
import { useToast } from '@documenso/ui/primitives/use-toast';

// import { addFields } from '~/components/forms/edit-document/add-fields.action';
import { addTemplatePlaceholders } from '~/components/forms/edit-document/add-template-placeholders.action';

// import { completeDocument } from '~/components/forms/edit-document/add-subject.action';

export type EditTemplateFormProps = {
  className?: string;
  user: User;
  template: Template;
  recipients: TemplateRecipient[];
  fields: TemplateField[];
  dataUrl: string;
};

// type EditTemplateStep = 'signers' | 'fields' | 'subject';
type EditTemplateStep = 'signers' | 'fields';

export const EditTemplateForm = ({
  className,
  template,
  recipients,
  fields,
  user: _user,
  dataUrl,
}: EditTemplateFormProps) => {
  const { toast } = useToast();
  const router = useRouter();

  const [step, setStep] = useState<EditTemplateStep>('signers');

  const documentFlow: Record<EditTemplateStep, DocumentFlowStep> = {
    signers: {
      title: 'Add Signers',
      description: 'Add the people who will sign the document.',
      stepIndex: 1,
    },
    fields: {
      title: 'Add Fields',
      description: 'Add all relevant fields for each recipient.',
      stepIndex: 2,
      onBackStep: () => setStep('signers'),
    },
    // subject: {
    //   title: 'Add Subject',
    //   description: 'Add the subject and message you wish to send to signers.',
    //   stepIndex: 3,
    //   onBackStep: () => setStep('fields'),
    // },
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
      console.error(err);

      toast({
        title: 'Error',
        description: 'An error occurred while adding signers.',
        variant: 'destructive',
      });
    }
  };

  //   const onAddFieldsFormSubmit = async (data: TAddFieldsFormSchema) => {
  //     try {
  //       // Custom invocation server action
  //       await addFields({
  //         documentId: document.id,
  //         fields: data.fields,
  //       });

  //       router.refresh();

  //       //   setStep('subject');
  //     } catch (err) {
  //       console.error(err);

  //       toast({
  //         title: 'Error',
  //         description: 'An error occurred while adding signers.',
  //         variant: 'destructive',
  //       });
  //     }
  //   };

  //   const onAddSubjectFormSubmit = async (data: TAddSubjectFormSchema) => {
  //     const { subject, message } = data.email;

  //     try {
  //       await completeDocument({
  //         documentId: document.id,
  //         email: {
  //           subject,
  //           message,
  //         },
  //       });

  //       toast({
  //         title: 'Document sent',
  //         description: 'Your document has been sent successfully.',
  //         duration: 5000,
  //       });

  //       router.push('/documents');
  //     } catch (err) {
  //       console.error(err);

  //       toast({
  //         title: 'Error',
  //         description: 'An error occurred while sending the document.',
  //         variant: 'destructive',
  //       });
  //     }
  //   };

  return (
    <div className={cn('grid w-full grid-cols-12 gap-8', className)}>
      <Card
        className="relative col-span-12 rounded-xl before:rounded-xl lg:col-span-6 xl:col-span-7"
        gradient
      >
        <CardContent className="p-2">
          <LazyPDFViewer document={dataUrl} />
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

          {step === 'fields' && <div>Fields</div>}

          {/* {step === 'fields' && (
            <AddFieldsFormPartial
              key={fields.length}
              documentFlow={documentFlow.fields}
              recipients={recipients}
              fields={fields}
              numberOfSteps={Object.keys(documentFlow).length}
              onSubmit={onAddFieldsFormSubmit}
            />
          )} */}

          {/* {step === 'subject' && (
            <AddSubjectFormPartial
              documentFlow={documentFlow.subject}
              document={document}
              recipients={recipients}
              fields={fields}
              numberOfSteps={Object.keys(documentFlow).length}
              onSubmit={onAddSubjectFormSubmit}
            />
          )} */}
        </DocumentFlowFormContainer>
      </div>
    </div>
  );
};
