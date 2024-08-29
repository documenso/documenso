'use client';

import { useEffect, useState } from 'react';

import { useRouter } from 'next/navigation';

import { zodResolver } from '@hookform/resolvers/zod';
import { Trans, msg } from '@lingui/macro';
import { Loader } from 'lucide-react';
import { useForm } from 'react-hook-form';

import { DO_NOT_INVALIDATE_QUERY_ON_MUTATION } from '@documenso/lib/constants/trpc';
import type { Field, Recipient } from '@documenso/prisma/client';
import { DocumentStatus } from '@documenso/prisma/client';
import type { DocumentWithData } from '@documenso/prisma/types/document-with-data';
import { trpc } from '@documenso/trpc/react';
import { DocumentSendEmailMessageHelper } from '@documenso/ui/components/document/document-send-email-message-helper';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { Button } from '../button';
import { FormErrorMessage } from '../form/form-error-message';
import { Input } from '../input';
import { Label } from '../label';
import { useStep } from '../stepper';
import { Textarea } from '../textarea';
import { type TAddSubjectFormSchema, ZAddSubjectFormSchema } from './add-subject.types';
import {
  DocumentFlowFormContainerActions,
  DocumentFlowFormContainerContent,
  DocumentFlowFormContainerFooter,
  DocumentFlowFormContainerHeader,
  DocumentFlowFormContainerStep,
} from './document-flow-root';
import { ShowFieldItem } from './show-field-item';
import type { DocumentFlowStep } from './types';

export type AddSubjectFormProps = {
  documentFlow: DocumentFlowStep;
  recipients: Recipient[];
  fields: Field[];
  document: DocumentWithData;
  onSubmit: (_data: TAddSubjectFormSchema) => void;
  isDocumentPdfLoaded: boolean;
};

export const AddSubjectFormPartial = ({
  documentFlow,
  recipients: recipients,
  fields: fields,
  document,
  onSubmit,
  isDocumentPdfLoaded,
}: AddSubjectFormProps) => {
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<TAddSubjectFormSchema>({
    defaultValues: {
      meta: {
        subject: document.documentMeta?.subject ?? '',
        message: document.documentMeta?.message ?? '',
      },
    },
    resolver: zodResolver(ZAddSubjectFormSchema),
  });

  const [oldEmailData, setOldEmailData] = useState<{ subject: string; message: string } | null>(
    document.documentMeta
      ? {
          subject: document.documentMeta.subject ?? '',
          message: document.documentMeta.message ?? '',
        }
      : null,
  );

  const [changedFields, setChangedFields] = useState<{ subject: boolean; message: boolean }>({
    subject: false,
    message: false,
  });

  const { toast } = useToast();
  const router = useRouter();
  const utils = trpc.useUtils();

  const { mutateAsync: setEmailSettingsForDocument } =
    trpc.document.setDocumentEmailSettings.useMutation({
      ...DO_NOT_INVALIDATE_QUERY_ON_MUTATION,
      onSuccess: () => {
        const data = utils.document.getDocumentWithDetailsById.getData({
          id: document.id,
        });

        setOldEmailData({
          subject: data?.documentMeta?.subject ?? '',
          message: data?.documentMeta?.message ?? '',
        });
      },
    });

  const handleOnBlur = async (field: 'subject' | 'message', value: string) => {
    if (value == oldEmailData?.[field]) return;

    try {
      await setEmailSettingsForDocument({
        documentId: document.id,
        [field]: value,
      });

      setChangedFields((prev) => ({ ...prev, [field]: true }));
      router.refresh();

      toast({
        title: 'Email settings updated',
        description: 'The email settings for the document have been updated.',
        duration: 5000,
      });
    } catch (e) {
      console.error(e);

      toast({
        title: 'Error',
        description: 'An error occurred while updating the email settings.',
        duration: 5000,
      });
    }
  };

  const handleUndoButton = async (field: 'subject' | 'message') => {
    if (!oldEmailData) return;

    try {
      await setEmailSettingsForDocument({
        documentId: document.id,
        [field]: oldEmailData[field],
      });

      setValue(`meta.${field}`, oldEmailData[field]);

      setOldEmailData((prev) => (prev ? { ...prev, [field]: undefined } : null));
      setChangedFields((prev) => ({ ...prev, [field]: false }));
      router.refresh();

      toast({
        title: 'Change reverted',
        description: `The latest change to the ${field} has been reverted.`,
        duration: 5000,
      });

      if (oldEmailData.subject === undefined && oldEmailData.message === undefined) {
        setOldEmailData(null);
      }
    } catch (e) {
      console.error(e);
      toast({
        title: 'Error',
        description: 'An error occurred while undoing the latest change',
        duration: 5000,
      });
    }
  };

  useEffect(() => {
    const timeout = setTimeout(() => {
      setChangedFields({ subject: false, message: false });
    }, 5000);

    return () => {
      clearTimeout(timeout);
    };
  }, [oldEmailData]);

  const onFormSubmit = handleSubmit(onSubmit);
  const { currentStep, totalSteps, previousStep } = useStep();

  return (
    <>
      <DocumentFlowFormContainerHeader
        title={documentFlow.title}
        description={documentFlow.description}
      />

      <DocumentFlowFormContainerContent>
        <div className="flex flex-col">
          {isDocumentPdfLoaded &&
            fields.map((field, index) => (
              <ShowFieldItem key={index} field={field} recipients={recipients} />
            ))}

          <div className="flex flex-col gap-y-4">
            <div>
              <Label htmlFor="subject">
                <Trans>
                  Subject <span className="text-muted-foreground">(Optional)</span>
                </Trans>
              </Label>

              <Input
                id="subject"
                className="bg-background mt-2"
                disabled={isSubmitting}
                {...register('meta.subject', {
                  onBlur: (event) => {
                    void handleOnBlur('subject', event.target.value);
                  },
                })}
              />

              {changedFields.subject && oldEmailData && (
                <div className="mt-2 flex items-center">
                  <Button
                    className="-ml-2"
                    size="sm"
                    variant="link"
                    onClick={() => void handleUndoButton('subject')}
                  >
                    <span className="text-xs">Undo change</span>
                    <Loader className="ml-1 h-4 w-4 animate-spin text-gray-500" />
                  </Button>
                </div>
              )}

              <FormErrorMessage className="mt-2" error={errors.meta?.subject} />
            </div>

            <div>
              <Label htmlFor="message">
                <Trans>
                  Message <span className="text-muted-foreground">(Optional)</span>
                </Trans>
              </Label>

              <Textarea
                id="message"
                className="bg-background mt-2 h-32 resize-none"
                disabled={isSubmitting}
                {...register('meta.message', {
                  onBlur: (event) => {
                    void handleOnBlur('message', event.target.value);
                  },
                })}
              />

              {changedFields.message && oldEmailData && (
                <div className="mt-2 flex items-center">
                  <Button
                    className="-ml-2"
                    size="sm"
                    variant="link"
                    onClick={() => void handleUndoButton('message')}
                  >
                    <span className="text-xs">Undo change</span>
                    <Loader className="ml-1 h-4 w-4 animate-spin text-gray-500" />
                  </Button>
                </div>
              )}

              <FormErrorMessage
                className="mt-2"
                error={typeof errors.meta?.message !== 'string' ? errors.meta?.message : undefined}
              />
            </div>
            <DocumentSendEmailMessageHelper />
          </div>
        </div>
      </DocumentFlowFormContainerContent>

      <DocumentFlowFormContainerFooter>
        <DocumentFlowFormContainerStep step={currentStep} maxStep={totalSteps} />

        <DocumentFlowFormContainerActions
          loading={isSubmitting}
          disabled={isSubmitting}
          goNextLabel={document.status === DocumentStatus.DRAFT ? msg`Send` : msg`Update`}
          onGoBackClick={previousStep}
          onGoNextClick={() => void onFormSubmit()}
        />
      </DocumentFlowFormContainerFooter>
    </>
  );
};
