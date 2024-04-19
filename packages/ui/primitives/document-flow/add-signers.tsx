'use client';

import React, { useId, useMemo, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { motion } from 'framer-motion';
import { InfoIcon, Plus, Trash } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useFieldArray, useForm } from 'react-hook-form';

import { useLimits } from '@documenso/ee/server-only/limits/provider/client';
import { DOCUMENT_AUTH_TYPES } from '@documenso/lib/constants/document-auth';
import {
  RecipientActionAuth,
  ZRecipientAuthOptionsSchema,
} from '@documenso/lib/types/document-auth';
import { nanoid } from '@documenso/lib/universal/id';
import type { Field, Recipient } from '@documenso/prisma/client';
import { RecipientRole, SendStatus } from '@documenso/prisma/client';
import { AnimateGenericFadeInOut } from '@documenso/ui/components/animate/animate-generic-fade-in-out';
import { cn } from '@documenso/ui/lib/utils';

import { Button } from '../button';
import { Checkbox } from '../checkbox';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../form/form';
import { FormErrorMessage } from '../form/form-error-message';
import { Input } from '../input';
import { ROLE_ICONS } from '../recipient-role-icons';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../select';
import { useStep } from '../stepper';
import { Tooltip, TooltipContent, TooltipTrigger } from '../tooltip';
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
  isDocumentEnterprise: boolean;
  onSubmit: (_data: TAddSignersFormSchema) => void;
  isDocumentPdfLoaded: boolean;
};

export const AddSignersFormPartial = ({
  documentFlow,
  recipients,
  fields,
  isDocumentEnterprise,
  onSubmit,
  isDocumentPdfLoaded,
}: AddSignersFormProps) => {
  const { toast } = useToast();
  const { remaining } = useLimits();
  const { data: session } = useSession();
  const user = session?.user;

  const initialId = useId();

  const { currentStep, totalSteps, previousStep } = useStep();

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
    formState: { errors, isSubmitting },
    control,
  } = form;

  const onFormSubmit = form.handleSubmit(onSubmit);

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

  const onAddSelfSigner = () => {
    appendSigner({
      formId: nanoid(12),
      name: user?.name ?? '',
      email: user?.email ?? '',
      role: RecipientRole.SIGNER,
      actionAuth: undefined,
    });
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
                            disabled={
                              isSubmitting ||
                              hasBeenSentToRecipientId(signer.nativeId) ||
                              signers[index].email === user?.email
                            }
                            onKeyDown={onKeyDown}
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
                            disabled={
                              isSubmitting ||
                              hasBeenSentToRecipientId(signer.nativeId) ||
                              signers[index].email === user?.email
                            }
                            onKeyDown={onKeyDown}
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
                            <Select
                              {...field}
                              onValueChange={field.onChange}
                              disabled={isSubmitting || hasBeenSentToRecipientId(signer.nativeId)}
                            >
                              <SelectTrigger className="bg-background text-muted-foreground">
                                <SelectValue placeholder="Inherit authentication method" />

                                <Tooltip>
                                  <TooltipTrigger className="-mr-1 ml-auto">
                                    <InfoIcon className="mx-2 h-4 w-4" />
                                  </TooltipTrigger>

                                  <TooltipContent className="text-foreground max-w-md p-4">
                                    <h2>
                                      <strong>Recipient action authentication</strong>
                                    </h2>

                                    <p>The authentication required for recipients to sign fields</p>

                                    <p className="mt-2">This will override any global settings.</p>

                                    <ul className="ml-3.5 list-outside list-disc space-y-0.5 py-2">
                                      <li>
                                        <strong>Inherit authentication method</strong> - Use the
                                        global action signing authentication method configured in
                                        the "General Settings" step
                                      </li>
                                      <li>
                                        <strong>Require account</strong> - The recipient must be
                                        signed in
                                      </li>
                                      <li>
                                        <strong>Require passkey</strong> - The recipient must have
                                        an account and passkey configured via their settings
                                      </li>
                                      <li>
                                        <strong>Require 2FA</strong> - The recipient must have an
                                        account and 2FA enabled via their settings
                                      </li>
                                      <li>
                                        <strong>None</strong> - No authentication required
                                      </li>
                                    </ul>
                                  </TooltipContent>
                                </Tooltip>
                              </SelectTrigger>

                              <SelectContent position="popper">
                                {/* Note: -1 is remapped in the Zod schema to the required value. */}
                                <SelectItem value="-1">Inherit authentication method</SelectItem>

                                {Object.values(RecipientActionAuth).map((authType) => (
                                  <SelectItem key={authType} value={authType}>
                                    {DOCUMENT_AUTH_TYPES[authType].value}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
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
                          <Select
                            {...field}
                            onValueChange={field.onChange}
                            disabled={isSubmitting || hasBeenSentToRecipientId(signer.nativeId)}
                          >
                            <SelectTrigger className="bg-background w-[60px]">
                              {/* eslint-disable-next-line @typescript-eslint/consistent-type-assertions */}
                              {ROLE_ICONS[field.value as RecipientRole]}
                            </SelectTrigger>

                            <SelectContent align="end">
                              <SelectItem value={RecipientRole.SIGNER}>
                                <div className="flex items-center">
                                  <div className="flex w-[150px] items-center">
                                    <span className="mr-2">{ROLE_ICONS[RecipientRole.SIGNER]}</span>
                                    Needs to sign
                                  </div>
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <InfoIcon className="h-4 w-4" />
                                    </TooltipTrigger>
                                    <TooltipContent className="text-foreground z-9999 max-w-md p-4">
                                      <p>
                                        The recipient is required to sign the document for it to be
                                        completed.
                                      </p>
                                    </TooltipContent>
                                  </Tooltip>
                                </div>
                              </SelectItem>

                              <SelectItem value={RecipientRole.APPROVER}>
                                <div className="flex items-center">
                                  <div className="flex w-[150px] items-center">
                                    <span className="mr-2">
                                      {ROLE_ICONS[RecipientRole.APPROVER]}
                                    </span>
                                    Needs to approve
                                  </div>
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <InfoIcon className="h-4 w-4" />
                                    </TooltipTrigger>
                                    <TooltipContent className="text-foreground z-9999 max-w-md p-4">
                                      <p>
                                        The recipient is required to approve the document for it to
                                        be completed.
                                      </p>
                                    </TooltipContent>
                                  </Tooltip>
                                </div>
                              </SelectItem>

                              <SelectItem value={RecipientRole.VIEWER}>
                                <div className="flex items-center">
                                  <div className="flex w-[150px] items-center">
                                    <span className="mr-2">{ROLE_ICONS[RecipientRole.VIEWER]}</span>
                                    Needs to view
                                  </div>
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <InfoIcon className="h-4 w-4" />
                                    </TooltipTrigger>
                                    <TooltipContent className="text-foreground z-9999 max-w-md p-4">
                                      <p>
                                        The recipient is required to view the document for it to be
                                        completed.
                                      </p>
                                    </TooltipContent>
                                  </Tooltip>
                                </div>
                              </SelectItem>

                              <SelectItem value={RecipientRole.CC}>
                                <div className="flex items-center">
                                  <div className="flex w-[150px] items-center">
                                    <span className="mr-2">{ROLE_ICONS[RecipientRole.CC]}</span>
                                    Receives copy
                                  </div>
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <InfoIcon className="h-4 w-4" />
                                    </TooltipTrigger>
                                    <TooltipContent className="text-foreground z-9999 max-w-md p-4">
                                      <p>
                                        The recipient is not required to take any action and
                                        receives a copy of the document after it is completed.
                                      </p>
                                    </TooltipContent>
                                  </Tooltip>
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>
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
                    onClick={() => onRemoveSigner(index)}
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
                disabled={
                  isSubmitting ||
                  form.getValues('signers').some((signer) => signer.email === user?.email)
                }
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
