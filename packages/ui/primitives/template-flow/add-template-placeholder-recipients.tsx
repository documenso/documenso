'use client';

import React, { useEffect, useId, useMemo, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { motion } from 'framer-motion';
import { Link2Icon, Plus, Trash } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useFieldArray, useForm } from 'react-hook-form';

import { ZRecipientAuthOptionsSchema } from '@documenso/lib/types/document-auth';
import { nanoid } from '@documenso/lib/universal/id';
import { generateRecipientPlaceholder } from '@documenso/lib/utils/templates';
import type { TemplateDirectLink } from '@documenso/prisma/client';
import { type Field, type Recipient, RecipientRole } from '@documenso/prisma/client';
import { AnimateGenericFadeInOut } from '@documenso/ui/components/animate/animate-generic-fade-in-out';
import { RecipientActionAuthSelect } from '@documenso/ui/components/recipient/recipient-action-auth-select';
import { RecipientRoleSelect } from '@documenso/ui/components/recipient/recipient-role-select';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import { FormErrorMessage } from '@documenso/ui/primitives/form/form-error-message';
import { Input } from '@documenso/ui/primitives/input';

import { Checkbox } from '../checkbox';
import {
  DocumentFlowFormContainerActions,
  DocumentFlowFormContainerContent,
  DocumentFlowFormContainerFooter,
  DocumentFlowFormContainerHeader,
  DocumentFlowFormContainerStep,
} from '../document-flow/document-flow-root';
import { ShowFieldItem } from '../document-flow/show-field-item';
import type { DocumentFlowStep } from '../document-flow/types';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../form/form';
import { useStep } from '../stepper';
import { Tooltip, TooltipContent, TooltipTrigger } from '../tooltip';
import type { TAddTemplatePlacholderRecipientsFormSchema } from './add-template-placeholder-recipients.types';
import { ZAddTemplatePlacholderRecipientsFormSchema } from './add-template-placeholder-recipients.types';

export type AddTemplatePlaceholderRecipientsFormProps = {
  documentFlow: DocumentFlowStep;
  recipients: Recipient[];
  fields: Field[];
  templateDirectLink: TemplateDirectLink | null;
  isEnterprise: boolean;
  isDocumentPdfLoaded: boolean;
  onSubmit: (_data: TAddTemplatePlacholderRecipientsFormSchema) => void;
};

export const AddTemplatePlaceholderRecipientsFormPartial = ({
  documentFlow,
  isEnterprise,
  recipients,
  templateDirectLink,
  fields,
  isDocumentPdfLoaded,
  onSubmit,
}: AddTemplatePlaceholderRecipientsFormProps) => {
  const initialId = useId();
  const { data: session } = useSession();

  const user = session?.user;

  const [placeholderRecipientCount, setPlaceholderRecipientCount] = useState(() =>
    recipients.length > 1 ? recipients.length + 1 : 2,
  );

  const { currentStep, totalSteps, previousStep } = useStep();

  const generateDefaultFormSigners = () => {
    if (recipients.length === 0) {
      return [
        {
          formId: initialId,
          role: RecipientRole.SIGNER,
          actionAuth: undefined,
          ...generateRecipientPlaceholder(1),
        },
      ];
    }

    return recipients.map((recipient) => ({
      nativeId: recipient.id,
      formId: String(recipient.id),
      name: recipient.name,
      email: recipient.email,
      role: recipient.role,
      actionAuth: ZRecipientAuthOptionsSchema.parse(recipient.authOptions)?.actionAuth ?? undefined,
    }));
  };

  const form = useForm<TAddTemplatePlacholderRecipientsFormSchema>({
    resolver: zodResolver(ZAddTemplatePlacholderRecipientsFormSchema),
    defaultValues: {
      signers: generateDefaultFormSigners(),
    },
  });

  useEffect(() => {
    form.reset({
      signers: generateDefaultFormSigners(),
    });

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipients]);

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

  const onAddPlaceholderSelfRecipient = () => {
    appendSigner({
      formId: nanoid(12),
      name: user?.name ?? '',
      email: user?.email ?? '',
      role: RecipientRole.SIGNER,
    });
  };

  const onAddPlaceholderRecipient = () => {
    appendSigner({
      formId: nanoid(12),
      role: RecipientRole.SIGNER,
      ...generateRecipientPlaceholder(placeholderRecipientCount),
    });

    setPlaceholderRecipientCount((count) => count + 1);
  };

  const onRemoveSigner = (index: number) => {
    removeSigner(index);
  };

  const isSignerDirectRecipient = (
    signer: TAddTemplatePlacholderRecipientsFormSchema['signers'][number],
  ): boolean => {
    return (
      templateDirectLink !== null &&
      signer.nativeId === templateDirectLink?.directTemplateRecipientId
    );
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
                  disabled={isSubmitting}
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
                              field.disabled ||
                              isSubmitting ||
                              signers[index].email === user?.email ||
                              isSignerDirectRecipient(signer)
                            }
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
                              field.disabled ||
                              isSubmitting ||
                              signers[index].email === user?.email ||
                              isSignerDirectRecipient(signer)
                            }
                          />
                        </FormControl>

                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {showAdvancedSettings && isEnterprise && (
                    <FormField
                      control={form.control}
                      name={`signers.${index}.actionAuth`}
                      render={({ field }) => (
                        <FormItem className="col-span-6">
                          <FormControl>
                            <RecipientActionAuthSelect
                              {...field}
                              onValueChange={field.onChange}
                              disabled={isSubmitting}
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
                            disabled={isSubmitting}
                            hideCCRecipients={isSignerDirectRecipient(signer)}
                          />
                        </FormControl>

                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {isSignerDirectRecipient(signer) ? (
                    <Tooltip>
                      <TooltipTrigger className="col-span-1 mt-auto inline-flex h-10 w-10 items-center justify-center text-slate-500 hover:opacity-80">
                        <Link2Icon className="h-4 w-4" />
                      </TooltipTrigger>
                      <TooltipContent className="text-foreground z-9999 max-w-md p-4">
                        <h3 className="text-foreground text-lg font-semibold">
                          Direct link receiver
                        </h3>
                        <p className="text-muted-foreground mt-1">
                          This field cannot be modified or deleted. When you share this template's
                          direct link or add it to your public profile, anyone who accesses it can
                          input their name and email, and fill in the fields assigned to them.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <button
                      type="button"
                      className="col-span-1 mt-auto inline-flex h-10 w-10 items-center justify-center text-slate-500 hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={isSubmitting || signers.length === 1}
                      onClick={() => onRemoveSigner(index)}
                    >
                      <Trash className="h-5 w-5" />
                    </button>
                  )}
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
                disabled={isSubmitting}
                onClick={() => onAddPlaceholderRecipient()}
              >
                <Plus className="-ml-1 mr-2 h-5 w-5" />
                Add Placeholder Recipient
              </Button>

              <Button
                type="button"
                className="dark:bg-muted dark:hover:bg-muted/80 bg-black/5 hover:bg-black/10"
                variant="secondary"
                disabled={
                  isSubmitting ||
                  form.getValues('signers').some((signer) => signer.email === user?.email)
                }
                onClick={() => onAddPlaceholderSelfRecipient()}
              >
                <Plus className="-ml-1 mr-2 h-5 w-5" />
                Add Myself
              </Button>
            </div>

            {!alwaysShowAdvancedSettings && isEnterprise && (
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
          canGoBack={currentStep > 1}
          onGoBackClick={() => previousStep()}
          onGoNextClick={() => void onFormSubmit()}
        />
      </DocumentFlowFormContainerFooter>
    </>
  );
};
