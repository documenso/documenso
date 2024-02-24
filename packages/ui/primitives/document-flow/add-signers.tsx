'use client';

import React, { useId } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus, Trash } from 'lucide-react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';

import { useLimits } from '@documenso/ee/server-only/limits/provider/client';
import { nanoid } from '@documenso/lib/universal/id';
import type { Field, Recipient } from '@documenso/prisma/client';
import { DocumentStatus, RecipientRole, SendStatus } from '@documenso/prisma/client';
import type { DocumentWithData } from '@documenso/prisma/types/document-with-data';

import { Button } from '../button';
import { FormErrorMessage } from '../form/form-error-message';
import { Input } from '../input';
import { Label } from '../label';
import { ROLE_ICONS } from '../recipient-role-icons';
import { Select, SelectContent, SelectItem, SelectTrigger } from '../select';
import { useStep } from '../stepper';
import { useToast } from '../use-toast';
import type { TAddSignersFormSchema } from './add-signers.types';
import { ZAddSignersFormSchema } from './add-signers.types';
import {
  DocumentFlowFormContainerActions,
  DocumentFlowFormContainerContent,
  DocumentFlowFormContainerFooter,
  DocumentFlowFormContainerHeader,
  DocumentFlowFormContainerStep,
} from './document-flow-root';
import { ShowFieldItem } from './show-field-item';
import type { DocumentFlowStep } from './types';

export type AddSignersFormProps = {
  documentFlow: DocumentFlowStep;
  recipients: Recipient[];
  fields: Field[];
  document: DocumentWithData;
  onSubmit: (_data: TAddSignersFormSchema) => void;
};

export const AddSignersFormPartial = ({
  documentFlow,
  recipients,
  document,
  fields,
  onSubmit,
}: AddSignersFormProps) => {
  const { toast } = useToast();
  const { remaining } = useLimits();

  const initialId = useId();

  const { currentStep, totalSteps, previousStep } = useStep();

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<TAddSignersFormSchema>({
    resolver: zodResolver(ZAddSignersFormSchema),
    defaultValues: {
      signers:
        recipients.length > 0
          ? recipients.map((recipient) => ({
              nativeId: recipient.id,
              formId: String(recipient.id),
              name: recipient.name,
              email: recipient.email,
              role: recipient.role,
            }))
          : [
              {
                formId: initialId,
                name: '',
                email: '',
                role: RecipientRole.SIGNER,
              },
            ],
    },
  });

  const onFormSubmit = handleSubmit(onSubmit);

  const {
    append: appendSigner,
    fields: signers,
    remove: removeSigner,
  } = useFieldArray({
    control,
    name: 'signers',
  });

  const hasBeenSentToRecipientId = (id?: number) => {
    if (!id) {
      return false;
    }

    return recipients.some(
      (recipient) =>
        recipient.id === id &&
        recipient.sendStatus === SendStatus.SENT &&
        recipient.role !== RecipientRole.CC,
    );
  };

  const onAddSigner = () => {
    appendSigner({
      formId: nanoid(12),
      name: '',
      email: '',
      role: RecipientRole.SIGNER,
    });
  };

  const onRemoveSigner = (index: number) => {
    const signer = signers[index];

    if (hasBeenSentToRecipientId(signer.nativeId)) {
      toast({
        title: 'Cannot remove signer',
        description: 'This signer has already received the document.',
        variant: 'destructive',
      });

      return;
    }

    removeSigner(index);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && event.target instanceof HTMLInputElement) {
      onAddSigner();
    }
  };

  return (
    <>
      <DocumentFlowFormContainerHeader
        title={documentFlow.title}
        description={documentFlow.description}
      />
      <DocumentFlowFormContainerContent>
        <div className="flex w-full flex-col gap-y-4">
          {fields.map((field, index) => (
            <ShowFieldItem key={index} field={field} recipients={recipients} />
          ))}

          <AnimatePresence>
            {signers.map((signer, index) => (
              <motion.div
                key={signer.id}
                data-native-id={signer.nativeId}
                className="flex flex-wrap items-end gap-x-4"
              >
                <div className="flex-1">
                  <Label htmlFor={`signer-${signer.id}-email`}>
                    Email
                    <span className="text-destructive ml-1 inline-block font-medium">*</span>
                  </Label>

                  <Controller
                    control={control}
                    name={`signers.${index}.email`}
                    render={({ field }) => (
                      <Input
                        id={`signer-${signer.id}-email`}
                        type="email"
                        className="bg-background mt-2"
                        disabled={isSubmitting || hasBeenSentToRecipientId(signer.nativeId)}
                        onKeyDown={onKeyDown}
                        {...field}
                      />
                    )}
                  />
                </div>

                <div className="flex-1">
                  <Label htmlFor={`signer-${signer.id}-name`}>Name</Label>

                  <Controller
                    control={control}
                    name={`signers.${index}.name`}
                    render={({ field }) => (
                      <Input
                        id={`signer-${signer.id}-name`}
                        type="text"
                        className="bg-background mt-2"
                        disabled={isSubmitting || hasBeenSentToRecipientId(signer.nativeId)}
                        onKeyDown={onKeyDown}
                        {...field}
                      />
                    )}
                  />
                </div>

                <div className="w-[60px]">
                  <Controller
                    control={control}
                    name={`signers.${index}.role`}
                    render={({ field: { value, onChange } }) => (
                      <Select value={value} onValueChange={(x) => onChange(x)}>
                        <SelectTrigger className="bg-background">{ROLE_ICONS[value]}</SelectTrigger>

                        <SelectContent className="" align="end">
                          <SelectItem value={RecipientRole.SIGNER}>
                            <div className="flex items-center">
                              <span className="mr-2">{ROLE_ICONS[RecipientRole.SIGNER]}</span>
                              Signer
                            </div>
                          </SelectItem>

                          <SelectItem value={RecipientRole.CC}>
                            <div className="flex items-center">
                              <span className="mr-2">{ROLE_ICONS[RecipientRole.CC]}</span>
                              Receives copy
                            </div>
                          </SelectItem>

                          <SelectItem value={RecipientRole.APPROVER}>
                            <div className="flex items-center">
                              <span className="mr-2">{ROLE_ICONS[RecipientRole.APPROVER]}</span>
                              Approver
                            </div>
                          </SelectItem>

                          <SelectItem value={RecipientRole.VIEWER}>
                            <div className="flex items-center">
                              <span className="mr-2">{ROLE_ICONS[RecipientRole.VIEWER]}</span>
                              Viewer
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>

                <div>
                  <button
                    type="button"
                    className="justify-left inline-flex h-10 w-10 items-center text-slate-500 hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={
                      isSubmitting ||
                      hasBeenSentToRecipientId(signer.nativeId) ||
                      signers.length === 1
                    }
                    onClick={() => onRemoveSigner(index)}
                  >
                    <Trash className="h-5 w-5" />
                  </button>
                </div>

                <div className="w-full">
                  <FormErrorMessage className="mt-2" error={errors.signers?.[index]?.email} />
                  <FormErrorMessage className="mt-2" error={errors.signers?.[index]?.name} />
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        <FormErrorMessage
          className="mt-2"
          // Dirty hack to handle errors when .root is populated for an array type
          error={'signers__root' in errors && errors['signers__root']}
        />

        <div className="mt-4">
          <Button
            type="button"
            disabled={isSubmitting || signers.length >= remaining.recipients}
            onClick={() => onAddSigner()}
          >
            <Plus className="-ml-1 mr-2 h-5 w-5" />
            Add Signer
          </Button>
        </div>
      </DocumentFlowFormContainerContent>

      <DocumentFlowFormContainerFooter>
        <DocumentFlowFormContainerStep
          title={documentFlow.title}
          step={currentStep}
          maxStep={totalSteps}
        />

        <DocumentFlowFormContainerActions
          canGoBack={document.status === DocumentStatus.DRAFT}
          loading={isSubmitting}
          disabled={isSubmitting}
          onGoBackClick={previousStep}
          onGoNextClick={() => void onFormSubmit()}
        />
      </DocumentFlowFormContainerFooter>
    </>
  );
};
