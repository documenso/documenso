'use client';

import { useState } from 'react';

import { useRouter } from 'next/navigation';

import { Document, Field, Recipient, User } from '@documenso/prisma/client';
import { cn } from '@documenso/ui/lib/utils';
import { Card, CardContent } from '@documenso/ui/primitives/card';
import { AddFieldsFormPartial } from '@documenso/ui/primitives/document-flow/add-fields';
import { TAddFieldsFormSchema } from '@documenso/ui/primitives/document-flow/add-fields.types';
import { AddSignersFormPartial } from '@documenso/ui/primitives/document-flow/add-signers';
import { TAddSignersFormSchema } from '@documenso/ui/primitives/document-flow/add-signers.types';
import { AddSubjectFormPartial } from '@documenso/ui/primitives/document-flow/add-subject';
import { TAddSubjectFormSchema } from '@documenso/ui/primitives/document-flow/add-subject.types';
import { LazyPDFViewer } from '@documenso/ui/primitives/lazy-pdf-viewer';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { addFields } from '~/components/forms/edit-document/add-fields.action';
import { addSigners } from '~/components/forms/edit-document/add-signers.action';
import { completeDocument } from '~/components/forms/edit-document/add-subject.action';

export type EditDocumentFormProps = {
  className?: string;
  user: User;
  document: Document;
  recipients: Recipient[];
  fields: Field[];
};

export const EditDocumentForm = ({
  className,
  document,
  recipients,
  fields,
  user: _user,
}: EditDocumentFormProps) => {
  const { toast } = useToast();
  const router = useRouter();

  const [step, setStep] = useState<'signers' | 'fields' | 'subject'>('signers');

  const documentUrl = `data:application/pdf;base64,${document.document}`;

  const onNextStep = () => {
    if (step === 'signers') {
      setStep('fields');
    }

    if (step === 'fields') {
      setStep('subject');
    }
  };

  const onPreviousStep = () => {
    if (step === 'fields') {
      setStep('signers');
    }

    if (step === 'subject') {
      setStep('fields');
    }
  };

  const onAddSignersFormSubmit = async (data: TAddSignersFormSchema) => {
    try {
      // Custom invocation server action
      await addSigners({
        documentId: document.id,
        signers: data.signers,
      });

      router.refresh();

      onNextStep();
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
      // Custom invocation server action
      await addFields({
        documentId: document.id,
        fields: data.fields,
      });

      router.refresh();

      onNextStep();
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
    const { subject, message } = data.email;

    try {
      await completeDocument({
        documentId: document.id,
        email: {
          subject,
          message,
        },
      });

      router.refresh();

      onNextStep();
    } catch (err) {
      console.error(err);

      toast({
        title: 'Error',
        description: 'An error occurred while sending the document.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className={cn('grid w-full grid-cols-12 gap-8', className)}>
      <Card
        className="col-span-12 rounded-xl before:rounded-xl lg:col-span-6 xl:col-span-7"
        gradient
      >
        <CardContent className="p-2">
          <LazyPDFViewer document={documentUrl} />
        </CardContent>
      </Card>

      <div className="col-span-12 lg:col-span-6 xl:col-span-5">
        {step === 'signers' && (
          <AddSignersFormPartial
            recipients={recipients}
            fields={fields}
            document={document}
            onContinue={onNextStep}
            onGoBack={onPreviousStep}
            onSubmit={onAddSignersFormSubmit}
          />
        )}

        {step === 'fields' && (
          <AddFieldsFormPartial
            recipients={recipients}
            fields={fields}
            document={document}
            onContinue={onNextStep}
            onGoBack={onPreviousStep}
            onSubmit={onAddFieldsFormSubmit}
          />
        )}

        {step === 'subject' && (
          <AddSubjectFormPartial
            recipients={recipients}
            fields={fields}
            document={document}
            onContinue={onNextStep}
            onGoBack={onPreviousStep}
            onSubmit={onAddSubjectFormSubmit}
          />
        )}
      </div>
    </div>
  );
};
