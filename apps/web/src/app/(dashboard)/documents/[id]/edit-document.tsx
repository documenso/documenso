'use client';

import { useState } from 'react';

import dynamic from 'next/dynamic';

import { Loader } from 'lucide-react';

import { Document, Field, Recipient, User } from '@documenso/prisma/client';
import { cn } from '@documenso/ui/lib/utils';
import { Card, CardContent } from '@documenso/ui/primitives/card';

import { AddFieldsFormPartial } from '~/components/forms/edit-document/add-fields';
import { AddSignersFormPartial } from '~/components/forms/edit-document/add-signers';
import { AddSubjectFormPartial } from '~/components/forms/edit-document/add-subject';

const PDFViewer = dynamic(async () => import('~/components/(dashboard)/pdf-viewer/pdf-viewer'), {
  ssr: false,
  loading: () => (
    <div className="dark:bg-background flex min-h-[80vh] flex-col items-center justify-center bg-white/50">
      <Loader className="text-documenso h-12 w-12 animate-spin" />

      <p className="text-muted-foreground mt-4">Loading document...</p>
    </div>
  ),
});

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

  return (
    <div className={cn('grid w-full grid-cols-12 gap-8', className)}>
      <Card
        className="col-span-12 rounded-xl before:rounded-xl lg:col-span-6 xl:col-span-7"
        gradient
      >
        <CardContent className="p-2">
          <PDFViewer document={documentUrl} />
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
          />
        )}

        {step === 'fields' && (
          <AddFieldsFormPartial
            recipients={recipients}
            fields={fields}
            document={document}
            onContinue={onNextStep}
            onGoBack={onPreviousStep}
          />
        )}

        {step === 'subject' && (
          <AddSubjectFormPartial
            recipients={recipients}
            fields={fields}
            document={document}
            onContinue={onNextStep}
            onGoBack={onPreviousStep}
          />
        )}
      </div>
    </div>
  );
};
