'use client';

import { useState } from 'react';

import { Document, Field, Recipient, User } from '@documenso/prisma/client';
import { cn } from '@documenso/ui/lib/utils';
import { Card, CardContent } from '@documenso/ui/primitives/card';

import { LazyPDFViewer } from '~/components/(dashboard)/pdf-viewer/lazy-pdf-viewer';
import { AddFieldsFormPartial } from '~/components/forms/edit-document/add-fields';
import { AddSignersFormPartial } from '~/components/forms/edit-document/add-signers';
import { AddSubjectFormPartial } from '~/components/forms/edit-document/add-subject';

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
