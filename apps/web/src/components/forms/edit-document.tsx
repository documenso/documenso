'use client';

import { useId, useState } from 'react';

import dynamic from 'next/dynamic';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader } from 'lucide-react';
import { useForm } from 'react-hook-form';

import { Document, Field, Recipient, User } from '@documenso/prisma/client';
import { trpc } from '@documenso/trpc/react';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import { Card, CardContent } from '@documenso/ui/primitives/card';

import { AddFieldsFormPartial } from './edit-document/add-fields';
import { AddSignersFormPartial } from './edit-document/add-signers';
import { AddSubjectFormPartial } from './edit-document/add-subject';
import { TEditDocumentFormSchema, ZEditDocumentFormSchema } from './edit-document/types';

const PDFViewer = dynamic(async () => import('~/components/(dashboard)/pdf-viewer/pdf-viewer'), {
  ssr: false,
  loading: () => (
    <div className="dark:bg-background flex min-h-[80vh] flex-col items-center justify-center bg-white/50">
      <Loader className="text-documenso h-12 w-12 animate-spin" />

      <p className="text-muted-foreground mt-4">Loading document...</p>
    </div>
  ),
});

const MAX_STEP = 2;

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
  const initialId = useId();

  const [step, setStep] = useState(0);
  const [nextStepLoading, setNextStepLoading] = useState(false);

  const documentUrl = `data:application/pdf;base64,${document.document}`;
  const defaultSigners =
    recipients.length > 0
      ? recipients.map((recipient) => ({
          nativeId: recipient.id,
          formId: `${recipient.id}-${recipient.documentId}`,
          name: recipient.name,
          email: recipient.email,
        }))
      : [
          {
            formId: initialId,
            name: '',
            email: '',
          },
        ];

  const defaultFields = fields.map((field) => ({
    nativeId: field.id,
    formId: `${field.id}-${field.documentId}`,
    pageNumber: field.page,
    type: field.type,
    pageX: Number(field.positionX),
    pageY: Number(field.positionY),
    pageWidth: Number(field.width),
    pageHeight: Number(field.height),
    signerEmail: recipients.find((recipient) => recipient.id === field.recipientId)?.email ?? '',
  }));

  const { mutateAsync: setRecipientsForDocument } =
    trpc.document.setRecipientsForDocument.useMutation();

  const { mutateAsync: setFieldsForDocument } = trpc.document.setFieldsForDocument.useMutation();

  const {
    control,
    handleSubmit,
    watch,
    trigger,
    formState: { errors, isSubmitting },
  } = useForm<TEditDocumentFormSchema>({
    mode: 'onBlur',
    defaultValues: {
      signers: defaultSigners,
      fields: defaultFields,
      email: {
        subject: '',
        message: '',
      },
    },
    resolver: zodResolver(ZEditDocumentFormSchema),
  });

  const signersFormValue = watch('signers');
  const fieldsFormValue = watch('fields');

  console.log({ state: watch(), errors });

  const canGoBack = step > 0;
  const canGoNext = step < MAX_STEP;

  const onGoBackClick = () => setStep((prev) => Math.max(0, prev - 1));
  const onGoNextClick = async () => {
    setNextStepLoading(true);

    const passes = await trigger();

    if (step === 0) {
      await setRecipientsForDocument({
        documentId: document.id,
        recipients: signersFormValue.map((signer) => ({
          id: signer.nativeId ?? undefined,
          name: signer.name,
          email: signer.email,
        })),
      }).catch((err: unknown) => console.error(err));
    }

    if (step === 1) {
      await setFieldsForDocument({
        documentId: document.id,
        fields: fieldsFormValue.map((field) => ({
          id: field.nativeId ?? undefined,
          type: field.type,
          signerEmail: field.signerEmail,
          pageNumber: field.pageNumber,
          pageX: field.pageX,
          pageY: field.pageY,
          pageWidth: field.pageWidth,
          pageHeight: field.pageHeight,
        })),
      }).catch((err: unknown) => console.error(err));
    }

    if (passes) {
      setStep((prev) => Math.min(MAX_STEP, prev + 1));
    }

    console.log({ passes });

    setNextStepLoading(false);
  };

  return (
    <div className={cn('grid w-full grid-cols-12 gap-x-8', className)}>
      <Card className="col-span-7 rounded-xl before:rounded-xl" gradient>
        <CardContent className="p-2">
          <PDFViewer document={documentUrl} />
        </CardContent>
      </Card>

      <div className="col-span-5">
        <form
          className="dark:bg-background border-border sticky top-20 flex h-[calc(100vh-6rem)] max-h-screen flex-col rounded-xl border bg-[hsl(var(--widget))] px-4 py-6"
          onSubmit={handleSubmit(console.log)}
        >
          {step === 0 && (
            <AddSignersFormPartial
              className="-mx-2 flex-1 overflow-y-hidden px-2"
              control={control}
              watch={watch}
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

          {step === 2 && (
            <AddSubjectFormPartial
              className="-mx-2 flex-1 overflow-y-hidden px-2"
              control={control}
              watch={watch}
              errors={errors}
              isSubmitting={isSubmitting}
            />
          )}

          <div className="mt-4 flex-shrink-0">
            <p className="text-muted-foreground text-sm">
              Add Signers ({step + 1}/{MAX_STEP + 1})
            </p>

            <div className="bg-muted relative mt-4 h-[2px] rounded-md">
              <div
                className="bg-documenso absolute inset-y-0 left-0"
                style={{
                  width: `${(100 / (MAX_STEP + 1)) * (step + 1)}%`,
                }}
              />
            </div>

            <div className="mt-4 flex gap-x-4">
              <Button
                type="button"
                className="dark:bg-muted dark:hover:bg-muted/80 flex-1 bg-black/5 hover:bg-black/10"
                size="lg"
                variant="secondary"
                disabled={!canGoBack}
                onClick={onGoBackClick}
              >
                Go Back
              </Button>

              {step < MAX_STEP && (
                <Button
                  type="button"
                  className="bg-documenso flex-1"
                  size="lg"
                  disabled={!canGoNext}
                  onClick={onGoNextClick}
                >
                  {nextStepLoading && <Loader className="mr-2 h-5 w-5 animate-spin" />}
                  Continue
                </Button>
              )}

              {step === MAX_STEP && (
                <Button type="submit" className="bg-documenso flex-1" size="lg">
                  Complete
                </Button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
