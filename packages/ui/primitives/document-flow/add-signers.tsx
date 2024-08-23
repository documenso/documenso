'use client';

import React, { useId, useMemo, useState } from 'react';

import { useRouter } from 'next/navigation';

import { zodResolver } from '@hookform/resolvers/zod';
import { motion } from 'framer-motion';
import { Plus, Trash } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useFieldArray, useForm } from 'react-hook-form';

import { useLimits } from '@documenso/ee/server-only/limits/provider/client';
import { DO_NOT_INVALIDATE_QUERY_ON_MUTATION } from '@documenso/lib/constants/trpc';
import { ZRecipientAuthOptionsSchema } from '@documenso/lib/types/document-auth';
import { nanoid } from '@documenso/lib/universal/id';
import type { Field, Recipient } from '@documenso/prisma/client';
import { RecipientRole, SendStatus } from '@documenso/prisma/client';
import type { DocumentWithDetails } from '@documenso/prisma/types/document';
import { trpc } from '@documenso/trpc/react';
import { AnimateGenericFadeInOut } from '@documenso/ui/components/animate/animate-generic-fade-in-out';
import { RecipientActionAuthSelect } from '@documenso/ui/components/recipient/recipient-action-auth-select';
import { RecipientRoleSelect } from '@documenso/ui/components/recipient/recipient-role-select';
import { cn } from '@documenso/ui/lib/utils';

import { Button } from '../button';
import { Checkbox } from '../checkbox';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../form/form';
import { FormErrorMessage } from '../form/form-error-message';
import { Input } from '../input';
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
  document: DocumentWithDetails;
  recipients: Recipient[];
  fields: Field[];
  isDocumentEnterprise: boolean;
  onSubmit: (_data: TAddSignersFormSchema) => void;
  isDocumentPdfLoaded: boolean;
  teamId?: number;
};

export const AddSignersFormPartial = ({
  documentFlow,
  document,
  recipients,
  fields,
  isDocumentEnterprise,
  onSubmit,
  isDocumentPdfLoaded,
  teamId,
}: AddSignersFormProps) => {
  const { toast } = useToast();
  const { remaining } = useLimits();
  const { data: session } = useSession();
  const router = useRouter();
  const user = session?.user;

  const initialId = useId();
  const utils = trpc.useUtils();

  const { currentStep, totalSteps, previousStep } = useStep();

  const { mutateAsync: addSigners } = trpc.recipient.addSigners.useMutation({
    ...DO_NOT_INVALIDATE_QUERY_ON_MUTATION,
    onSuccess: (newRecipients) => {
      console.log('add signer mutation', newRecipients);
      utils.document.getDocumentWithDetailsById.setData(
        {
          id: document.id,
          teamId,
        },
        (oldData) => ({ ...(oldData || document), Recipient: newRecipients }),
      );
    },
  });

  const { mutateAsync: deleteSigner } = trpc.recipient.removeSigner.useMutation({
    ...DO_NOT_INVALIDATE_QUERY_ON_MUTATION,
    onSuccess: (deletedRecipient) => {
      console.log('delete signer mutation', deletedRecipient);
      utils.document.getDocumentWithDetailsById.setData(
        {
          id: document.id,
          teamId,
        },
        (oldData) => {
          if (!oldData) return document;
          return {
            ...oldData,
            Recipient: oldData.Recipient.filter((r) => r.id !== deletedRecipient.id),
          };
        },
      );
    },
  });

  const form = useForm<TAddSignersFormSchema>({
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
              actionAuth:
                ZRecipientAuthOptionsSchema.parse(recipient.authOptions)?.actionAuth ?? undefined,
            }))
          : [
              {
                formId: initialId,
                name: '',
                email: '',
                role: RecipientRole.SIGNER,
                actionAuth: undefined,
              },
            ],
    },
  });

  // Always show advanced settings if any recipient has auth options.
  const alwaysShowAdvancedSettings = useMemo(() => {
    const recipientHasAuthOptions = recipients.find((recipient) => {
      const recipientAuthOptions = ZRecipientAuthOptionsSchema.parse(recipient.authOptions);

      return recipientAuthOptions?.accessAuth || recipientAuthOptions?.actionAuth;
    });

    const formHasActionAuth = form.getValues('signers').find((signer) => signer.actionAuth);

    return recipientHasAuthOptions !== undefined || formHasActionAuth !== undefined;
  }, [recipients, form]);

  const [showAdvancedSettings, setShowAdvancedSettings] = useState(alwaysShowAdvancedSettings);

  const {
    setValue,
    formState: { errors, isSubmitting },
    control,
    watch,
  } = form;

  const watchedSigners = watch('signers');

  const onFormSubmit = form.handleSubmit(onSubmit);

  const {
    append: appendSigner,
    fields: signers,
    remove: removeSigner,
  } = useFieldArray({
    control,
    name: 'signers',
  });

  const emptySignerIndex = watchedSigners.findIndex((signer) => !signer.name && !signer.email);
  const isUserAlreadyARecipient = watchedSigners.some(
    (signer) => signer.email.toLowerCase() === user?.email?.toLowerCase(),
  );

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
      actionAuth: undefined,
    });
  };

  /* TODO: Add self-signer to db on blur */
  const onAddSelfSigner = () => {
    if (emptySignerIndex !== -1) {
      setValue(`signers.${emptySignerIndex}.name`, user?.name ?? '');
      setValue(`signers.${emptySignerIndex}.email`, user?.email ?? '');
    } else {
      appendSigner({
        formId: nanoid(12),
        name: user?.name ?? '',
        email: user?.email ?? '',
        role: RecipientRole.SIGNER,
        actionAuth: undefined,
      });
    }
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && event.target instanceof HTMLInputElement) {
      onAddSigner();
    }
  };

  const handleOnBlur = async (index: number) => {
    try {
      const currentSigner = form.getValues(`signers.${index}`);

      if (!currentSigner.email) {
        return;
      }

      await addSigners({
        documentId: document.id,
        teamId: teamId,
        signers: form.getValues('signers').map((signer) => ({
          ...signer,
          actionAuth: signer.actionAuth || null,
        })),
      });

      const isNewSigner = !currentSigner.nativeId;

      toast({
        title: isNewSigner ? 'Signer added' : 'Signer updated',
        description: isNewSigner
          ? 'The signer has been added to the document.'
          : 'The signer information has been updated.',
      });

      router.refresh();
    } catch (e) {
      console.error(e);
      toast({
        title: 'Error',
        description: 'An error occurred while updating the document settings.',
        variant: 'destructive',
      });
    }
  };

  const handleRemoveSigner = async (index: number) => {
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

    if (signer.nativeId) {
      await deleteSigner({
        documentId: document.id,
        teamId: teamId,
        recipientId: signer.nativeId,
      });

      toast({
        title: 'Signer removed',
        description: 'The signer has been removed from the document.',
      });
    }
  };

  return (
    <>
      <DocumentFlowFormContainerHeader
        title={documentFlow.title}
        description={documentFlow.description}
      />
      <DocumentFlowFormContainerContent>
        {isDocumentPdfLoaded &&
          fields.map((field, index) => (
            <ShowFieldItem key={index} field={field} recipients={recipients} />
          ))}

        <AnimateGenericFadeInOut motionKey={showAdvancedSettings ? 'Show' : 'Hide'}>
          <Form {...form}>
            <div className="flex w-full flex-col gap-y-2">
              {signers.map((signer, index) => (
                <motion.fieldset
                  key={signer.id}
                  data-native-id={signer.nativeId}
                  disabled={isSubmitting || hasBeenSentToRecipientId(signer.nativeId)}
                  className={cn('grid grid-cols-8 gap-4 pb-4', {
                    'border-b pt-2': showAdvancedSettings,
                  })}
                >
                  <FormField
                    control={form.control}
                    name={`signers.${index}.email`}
                    render={({ field }) => (
                      <FormItem
                        className={cn('relative', {
                          'col-span-3': !showAdvancedSettings,
                          'col-span-4': showAdvancedSettings,
                        })}
                      >
                        {!showAdvancedSettings && index === 0 && (
                          <FormLabel required>Email</FormLabel>
                        )}

                        <FormControl>
                          <Input
                            type="email"
                            placeholder="Email"
                            {...field}
                            disabled={isSubmitting || hasBeenSentToRecipientId(signer.nativeId)}
                            onKeyDown={onKeyDown}
                            onBlur={() => void handleOnBlur(index)}
                          />
                        </FormControl>

                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`signers.${index}.name`}
                    render={({ field }) => (
                      <FormItem
                        className={cn({
                          'col-span-3': !showAdvancedSettings,
                          'col-span-4': showAdvancedSettings,
                        })}
                      >
                        {!showAdvancedSettings && index === 0 && <FormLabel>Name</FormLabel>}

                        <FormControl>
                          <Input
                            placeholder="Name"
                            {...field}
                            disabled={isSubmitting || hasBeenSentToRecipientId(signer.nativeId)}
                            onKeyDown={onKeyDown}
                            onBlur={() => void handleOnBlur(index)}
                          />
                        </FormControl>

                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {showAdvancedSettings && isDocumentEnterprise && (
                    <FormField
                      control={form.control}
                      name={`signers.${index}.actionAuth`}
                      render={({ field }) => (
                        <FormItem className="col-span-6">
                          <FormControl>
                            <RecipientActionAuthSelect
                              {...field}
                              onValueChange={field.onChange}
                              disabled={isSubmitting || hasBeenSentToRecipientId(signer.nativeId)}
                            />
                          </FormControl>

                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  <FormField
                    name={`signers.${index}.role`}
                    render={({ field }) => (
                      <FormItem className="col-span-1 mt-auto">
                        <FormControl>
                          <RecipientRoleSelect
                            {...field}
                            onValueChange={field.onChange}
                            disabled={isSubmitting || hasBeenSentToRecipientId(signer.nativeId)}
                          />
                        </FormControl>

                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <button
                    type="button"
                    className="col-span-1 mt-auto inline-flex h-10 w-10 items-center justify-center text-slate-500 hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={
                      isSubmitting ||
                      hasBeenSentToRecipientId(signer.nativeId) ||
                      signers.length === 1
                    }
                    onClick={() => void handleRemoveSigner(index)}
                  >
                    <Trash className="h-5 w-5" />
                  </button>
                </motion.fieldset>
              ))}
            </div>

            <FormErrorMessage
              className="mt-2"
              // Dirty hack to handle errors when .root is populated for an array type
              error={'signers__root' in errors && errors['signers__root']}
            />

            <div
              className={cn('mt-2 flex flex-row items-center space-x-4', {
                'mt-4': showAdvancedSettings,
              })}
            >
              <Button
                type="button"
                className="flex-1"
                disabled={isSubmitting || signers.length >= remaining.recipients}
                onClick={() => onAddSigner()}
              >
                <Plus className="-ml-1 mr-2 h-5 w-5" />
                Add Signer
              </Button>

              <Button
                type="button"
                variant="secondary"
                className="dark:bg-muted dark:hover:bg-muted/80 bg-black/5 hover:bg-black/10"
                disabled={isSubmitting || isUserAlreadyARecipient}
                onClick={() => onAddSelfSigner()}
              >
                <Plus className="-ml-1 mr-2 h-5 w-5" />
                Add myself
              </Button>
            </div>

            {!alwaysShowAdvancedSettings && isDocumentEnterprise && (
              <div className="mt-4 flex flex-row items-center">
                <Checkbox
                  id="showAdvancedRecipientSettings"
                  className="h-5 w-5"
                  checkClassName="dark:text-white text-primary"
                  checked={showAdvancedSettings}
                  onCheckedChange={(value) => setShowAdvancedSettings(Boolean(value))}
                />

                <label
                  className="text-muted-foreground ml-2 text-sm"
                  htmlFor="showAdvancedRecipientSettings"
                >
                  Show advanced settings
                </label>
              </div>
            )}
          </Form>
        </AnimateGenericFadeInOut>
      </DocumentFlowFormContainerContent>

      <DocumentFlowFormContainerFooter>
        <DocumentFlowFormContainerStep
          title={documentFlow.title}
          step={currentStep}
          maxStep={totalSteps}
        />

        <DocumentFlowFormContainerActions
          loading={isSubmitting}
          disabled={isSubmitting}
          onGoBackClick={previousStep}
          onGoNextClick={() => void onFormSubmit()}
        />
      </DocumentFlowFormContainerFooter>
    </>
  );
};
