'use client';

import { useState } from 'react';

import dynamic from 'next/dynamic';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader } from 'lucide-react';
import { useForm } from 'react-hook-form';

import { Document, User } from '@documenso/prisma/client';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import { Card, CardContent } from '@documenso/ui/primitives/card';

import { AddFieldsFormPartial } from './edit-document/add-fields';
import { AddSignersFormPartial } from './edit-document/add-signers';
import { TEditDocumentFormSchema, ZEditDocumentFormSchema } from './edit-document/types';

const PDFViewer = dynamic(async () => import('~/components/(dashboard)/pdf-viewer/pdf-viewer'), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[80vh] flex-col items-center justify-center bg-white/50">
      <Loader className="h-12 w-12 animate-spin text-slate-500" />

      <p className="mt-4 text-slate-500">Loading document...</p>
    </div>
  ),
});

const MAX_STEP = 2;

export type EditDocumentFormProps = {
  className?: string;
  user: User;
  document: Document;
};

export const EditDocumentForm = ({ className, document, user: _user }: EditDocumentFormProps) => {
  const documentUrl = `data:application/pdf;base64,${document.document}`;

  const [step, setStep] = useState(0);

  const {
    control,
    // handleSubmit,
    watch,
    formState: { errors, isSubmitting, isValid },
  } = useForm<TEditDocumentFormSchema>({
    mode: 'onBlur',
    defaultValues: {
      signers: [
        {
          name: '',
          email: '',
        },
      ],
    },
    resolver: zodResolver(ZEditDocumentFormSchema),
  });

  const canGoBack = step > 0;
  const canGoNext = isValid && step < MAX_STEP;

  const onGoBackClick = () => setStep((prev) => Math.max(0, prev - 1));
  const onGoNextClick = () => setStep((prev) => Math.min(MAX_STEP, prev + 1));

  return (
    <div className={cn('grid w-full grid-cols-12 gap-x-8', className)}>
      <Card className="col-span-7 rounded-xl before:rounded-xl" gradient>
        <CardContent className="p-2">
          <PDFViewer document={documentUrl} />
        </CardContent>
      </Card>

      <div className="relative col-span-5">
        <div className="sticky top-20 flex h-[calc(100vh-6rem)] max-h-screen flex-col rounded-xl border bg-[hsl(var(--widget))] px-4 py-6">
          {step === 0 && (
            <AddSignersFormPartial
              className="-mx-2 flex-1 overflow-y-hidden px-2"
              control={control}
              errors={errors}
              isSubmitting={isSubmitting}
            />
          )}

          {step === 1 && (
            <AddFieldsFormPartial
              className="-mx-2 flex-1 overflow-y-hidden px-2"
              control={control}
              watch={watch}
              errors={errors}
              isSubmitting={isSubmitting}
            />
          )}

          <div className="mt-4 flex-shrink-0">
            <p className="text-sm text-black/30">
              Add Signers ({step + 1}/{MAX_STEP + 1})
            </p>

            <div className="relative mt-4 h-[2px] rounded-md bg-slate-300">
              <div
                className="bg-primary absolute inset-y-0 left-0"
                style={{
                  width: `${(100 / (MAX_STEP + 1)) * (step + 1)}%`,
                }}
              />
            </div>

            <div className="mt-4 flex gap-x-4">
              <Button
                className="flex-1 bg-black/5 hover:bg-black/10"
                size="lg"
                variant="secondary"
                disabled={!canGoBack}
                onClick={onGoBackClick}
              >
                Go Back
              </Button>

              <Button className="flex-1" size="lg" disabled={!canGoNext} onClick={onGoNextClick}>
                Continue
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
