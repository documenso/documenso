import { useCallback, useId, useMemo, useRef, useState } from 'react';

import type { DropResult, SensorAPI } from '@hello-pangea/dnd';
import { DragDropContext, Draggable, Droppable } from '@hello-pangea/dnd';
import { zodResolver } from '@hookform/resolvers/zod';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import type { Field, Recipient } from '@prisma/client';
import { DocumentSigningOrder, RecipientRole, SendStatus } from '@prisma/client';
import { motion } from 'framer-motion';
import { GripVerticalIcon, HelpCircle, Plus, Trash } from 'lucide-react';
import { useFieldArray, useForm } from 'react-hook-form';
import { prop, sortBy } from 'remeda';

import { useLimits } from '@documenso/ee/server-only/limits/provider/client';
import { useAutoSave } from '@documenso/lib/client-only/hooks/use-autosave';
import { useDebouncedValue } from '@documenso/lib/client-only/hooks/use-debounced-value';
import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { useSession } from '@documenso/lib/client-only/providers/session';
import { ZRecipientAuthOptionsSchema } from '@documenso/lib/types/document-auth';
import { nanoid } from '@documenso/lib/universal/id';
import { canRecipientBeModified as utilCanRecipientBeModified } from '@documenso/lib/utils/recipients';
import { trpc } from '@documenso/trpc/react';
import { AnimateGenericFadeInOut } from '@documenso/ui/components/animate/animate-generic-fade-in-out';
import { RecipientActionAuthSelect } from '@documenso/ui/components/recipient/recipient-action-auth-select';
import { RecipientRoleSelect } from '@documenso/ui/components/recipient/recipient-role-select';
import { cn } from '@documenso/ui/lib/utils';

import {
  DocumentReadOnlyFields,
  mapFieldsWithRecipients,
} from '../../components/document/document-read-only-fields';
import type { RecipientAutoCompleteOption } from '../../components/recipient/recipient-autocomplete-input';
import { RecipientAutoCompleteInput } from '../../components/recipient/recipient-autocomplete-input';
import { Button } from '../button';
import { Checkbox } from '../checkbox';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../form/form';
import { FormErrorMessage } from '../form/form-error-message';
import { Input } from '../input';
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
import { SigningOrderConfirmation } from './signing-order-confirmation';
import type { DocumentFlowStep } from './types';

type AutoSaveResponse = {
  recipients: Recipient[];
};

export type AddSignersFormProps = {
  documentFlow: DocumentFlowStep;
  recipients: Recipient[];
  fields: Field[];
  signingOrder?: DocumentSigningOrder | null;
  allowDictateNextSigner?: boolean;
  onSubmit: (_data: TAddSignersFormSchema) => void;
  onAutoSave: (_data: TAddSignersFormSchema) => Promise<AutoSaveResponse>;
  isDocumentPdfLoaded: boolean;
};

export const AddSignersFormPartial = ({
  documentFlow,
  recipients,
  fields,
  signingOrder,
  allowDictateNextSigner,
  onSubmit,
  onAutoSave,
  isDocumentPdfLoaded,
}: AddSignersFormProps) => {
  const { _ } = useLingui();
  const { toast } = useToast();
  const { remaining } = useLimits();
  const { user } = useSession();

  const [recipientSearchQuery, setRecipientSearchQuery] = useState('');

  const debouncedRecipientSearchQuery = useDebouncedValue(recipientSearchQuery, 500);

  const initialId = useId();
  const $sensorApi = useRef<SensorAPI | null>(null);

  const { currentStep, totalSteps, previousStep } = useStep();

  const organisation = useCurrentOrganisation();

  const { data: recipientSuggestionsData, isLoading } = trpc.recipient.suggestions.find.useQuery(
    {
      query: debouncedRecipientSearchQuery,
    },
    {
      enabled: debouncedRecipientSearchQuery.length > 1,
    },
  );

  const recipientSuggestions = recipientSuggestionsData?.results || [];

  const defaultRecipients = [
    {
      formId: initialId,
      name: '',
      email: '',
      role: RecipientRole.SIGNER,
      signingOrder: 1,
      actionAuth: [],
    },
  ];

  const form = useForm<TAddSignersFormSchema>({
    resolver: zodResolver(ZAddSignersFormSchema),
    defaultValues: {
      signers:
        recipients.length > 0
          ? sortBy(
              recipients.map((recipient, index) => ({
                nativeId: recipient.id,
                formId: String(recipient.id),
                name: recipient.name,
                email: recipient.email,
                role: recipient.role,
                signingOrder: recipient.signingOrder ?? index + 1,
                actionAuth:
                  ZRecipientAuthOptionsSchema.parse(recipient.authOptions)?.actionAuth ?? undefined,
              })),
              [prop('signingOrder'), 'asc'],
              [prop('nativeId'), 'asc'],
            )
          : defaultRecipients,
      signingOrder: signingOrder || DocumentSigningOrder.PARALLEL,
      allowDictateNextSigner: allowDictateNextSigner ?? false,
    },
  });

  // Always show advanced settings if any recipient has auth options.
  const alwaysShowAdvancedSettings = useMemo(() => {
    const recipientHasAuthOptions = recipients.find((recipient) => {
      const recipientAuthOptions = ZRecipientAuthOptionsSchema.parse(recipient.authOptions);

      return (
        recipientAuthOptions.accessAuth.length > 0 || recipientAuthOptions.actionAuth.length > 0
      );
    });

    const formHasActionAuth = form
      .getValues('signers')
      .find((signer) => signer.actionAuth.length > 0);

    return recipientHasAuthOptions !== undefined || formHasActionAuth !== undefined;
  }, [recipients, form]);

  const [showAdvancedSettings, setShowAdvancedSettings] = useState(alwaysShowAdvancedSettings);
  const [showSigningOrderConfirmation, setShowSigningOrderConfirmation] = useState(false);

  const {
    setValue,
    formState: { errors, isSubmitting },
    control,
    watch,
  } = form;

  const watchedSigners = watch('signers');
  const isSigningOrderSequential = watch('signingOrder') === DocumentSigningOrder.SEQUENTIAL;

  const hasAssistantRole = useMemo(() => {
    return watchedSigners.some((signer) => signer.role === RecipientRole.ASSISTANT);
  }, [watchedSigners]);

  const normalizeSigningOrders = (signers: typeof watchedSigners) => {
    return signers
      .sort((a, b) => (a.signingOrder ?? 0) - (b.signingOrder ?? 0))
      .map((signer, index) => ({ ...signer, signingOrder: index + 1 }));
  };

  const onFormSubmit = form.handleSubmit(onSubmit);

  const {
    append: appendSigner,
    fields: signers,
    remove: removeSigner,
  } = useFieldArray({
    control,
    name: 'signers',
  });

  const emptySigners = useCallback(
    () => form.getValues('signers').filter((signer) => signer.email === ''),
    [form],
  );

  const { scheduleSave } = useAutoSave(onAutoSave);

  const handleAutoSave = async () => {
    if (emptySigners().length > 0) {
      return;
    }

    const isFormValid = await form.trigger();

    if (!isFormValid) {
      return;
    }

    const formData = form.getValues();

    scheduleSave(formData, (response) => {
      // Sync the response recipients back to form state to prevent duplicates
      if (response?.recipients) {
        const currentSigners = form.getValues('signers');

        const updatedSigners = currentSigners.map((signer) => {
          // Find the matching recipient from the response using nativeId
          const matchingRecipient = response.recipients.find(
            (recipient) => recipient.id === signer.nativeId,
          );

          if (matchingRecipient) {
            // Update the signer with the server-returned data, especially the ID
            return {
              ...signer,
              nativeId: matchingRecipient.id,
            };
          } else if (!signer.nativeId) {
            // For new signers without nativeId, match by email and update with server ID
            // Bug: Multiple recipients with the same email will be matched incorrectly here.
            const newRecipient = response.recipients.find(
              (recipient) => recipient.email === signer.email,
            );
            if (newRecipient) {
              return {
                ...signer,
                nativeId: newRecipient.id,
              };
            }
          }

          return signer;
        });

        // Update the form state with the synced data
        form.setValue('signers', updatedSigners, { shouldValidate: false });
      }
    });
  };

  const emptySignerIndex = watchedSigners.findIndex((signer) => !signer.name && !signer.email);
  const isUserAlreadyARecipient = watchedSigners.some(
    (signer) => signer.email.toLowerCase() === user?.email?.toLowerCase(),
  );

  const hasDocumentBeenSent = recipients.some(
    (recipient) => recipient.sendStatus === SendStatus.SENT,
  );

  const canRecipientBeModified = (recipientId?: number) => {
    if (recipientId === undefined) {
      return true;
    }

    const recipient = recipients.find((recipient) => recipient.id === recipientId);

    if (!recipient) {
      return false;
    }

    return utilCanRecipientBeModified(recipient, fields);
  };

  const onAddSigner = () => {
    appendSigner({
      formId: nanoid(12),
      name: '',
      email: '',
      role: RecipientRole.SIGNER,
      actionAuth: [],
      signingOrder: signers.length > 0 ? (signers[signers.length - 1]?.signingOrder ?? 0) + 1 : 1,
    });
  };

  const onRemoveSigner = (index: number) => {
    const signer = signers[index];

    if (!canRecipientBeModified(signer.nativeId)) {
      toast({
        title: _(msg`Cannot remove signer`),
        description: _(msg`This signer has already signed the document.`),
        variant: 'destructive',
      });

      return;
    }

    const formStateIndex = form.getValues('signers').findIndex((s) => s.formId === signer.formId);
    if (formStateIndex !== -1) {
      removeSigner(formStateIndex);

      const updatedSigners = form.getValues('signers').filter((s) => s.formId !== signer.formId);

      form.setValue('signers', normalizeSigningOrders(updatedSigners), {
        shouldValidate: true,
        shouldDirty: true,
      });

      void handleAutoSave();
    }
  };

  const onAddSelfSigner = () => {
    if (emptySignerIndex !== -1) {
      setValue(`signers.${emptySignerIndex}.name`, user?.name ?? '', {
        shouldValidate: true,
        shouldDirty: true,
      });
      setValue(`signers.${emptySignerIndex}.email`, user?.email ?? '', {
        shouldValidate: true,
        shouldDirty: true,
      });

      form.setFocus(`signers.${emptySignerIndex}.email`);
    } else {
      appendSigner(
        {
          formId: nanoid(12),
          name: user?.name ?? '',
          email: user?.email ?? '',
          role: RecipientRole.SIGNER,
          actionAuth: [],
          signingOrder:
            signers.length > 0 ? (signers[signers.length - 1]?.signingOrder ?? 0) + 1 : 1,
        },
        {
          shouldFocus: true,
        },
      );

      void form.trigger('signers');
    }
  };

  const handleRecipientAutoCompleteSelect = (
    index: number,
    suggestion: RecipientAutoCompleteOption,
  ) => {
    setValue(`signers.${index}.email`, suggestion.email, {
      shouldValidate: true,
      shouldDirty: true,
    });
    setValue(`signers.${index}.name`, suggestion.name || '', {
      shouldValidate: true,
      shouldDirty: true,
    });
  };

  const onDragEnd = useCallback(
    async (result: DropResult) => {
      if (!result.destination) return;

      const items = Array.from(watchedSigners);
      const [reorderedSigner] = items.splice(result.source.index, 1);

      // Find next valid position
      let insertIndex = result.destination.index;
      while (insertIndex < items.length && !canRecipientBeModified(items[insertIndex].nativeId)) {
        insertIndex++;
      }

      items.splice(insertIndex, 0, reorderedSigner);

      const updatedSigners = items.map((signer, index) => ({
        ...signer,
        signingOrder: !canRecipientBeModified(signer.nativeId) ? signer.signingOrder : index + 1,
      }));

      form.setValue('signers', updatedSigners, {
        shouldValidate: true,
        shouldDirty: true,
      });

      const lastSigner = updatedSigners[updatedSigners.length - 1];
      if (lastSigner.role === RecipientRole.ASSISTANT) {
        toast({
          title: _(msg`Warning: Assistant as last signer`),
          description: _(
            msg`Having an assistant as the last signer means they will be unable to take any action as there are no subsequent signers to assist.`,
          ),
        });
      }

      await form.trigger('signers');

      void handleAutoSave();
    },
    [form, canRecipientBeModified, watchedSigners, handleAutoSave, toast],
  );

  const handleRoleChange = useCallback(
    (index: number, role: RecipientRole) => {
      const currentSigners = form.getValues('signers');
      const signingOrder = form.getValues('signingOrder');

      // Handle parallel to sequential conversion for assistants
      if (role === RecipientRole.ASSISTANT && signingOrder === DocumentSigningOrder.PARALLEL) {
        form.setValue('signingOrder', DocumentSigningOrder.SEQUENTIAL, {
          shouldValidate: true,
          shouldDirty: true,
        });
        toast({
          title: _(msg`Signing order is enabled.`),
          description: _(msg`You cannot add assistants when signing order is disabled.`),
          variant: 'destructive',
        });
        return;
      }

      const updatedSigners = currentSigners.map((signer, idx) => ({
        ...signer,
        role: idx === index ? role : signer.role,
        signingOrder: !canRecipientBeModified(signer.nativeId) ? signer.signingOrder : idx + 1,
      }));

      form.setValue('signers', updatedSigners, {
        shouldValidate: true,
        shouldDirty: true,
      });

      if (role === RecipientRole.ASSISTANT && index === updatedSigners.length - 1) {
        toast({
          title: _(msg`Warning: Assistant as last signer`),
          description: _(
            msg`Having an assistant as the last signer means they will be unable to take any action as there are no subsequent signers to assist.`,
          ),
        });
      }
    },
    [form, toast, canRecipientBeModified],
  );

  const handleSigningOrderChange = useCallback(
    (index: number, newOrderString: string) => {
      const trimmedOrderString = newOrderString.trim();
      if (!trimmedOrderString) {
        return;
      }

      const newOrder = Number(trimmedOrderString);
      if (!Number.isInteger(newOrder) || newOrder < 1) {
        return;
      }

      const currentSigners = form.getValues('signers');
      const signer = currentSigners[index];

      // Remove signer from current position and insert at new position
      const remainingSigners = currentSigners.filter((_, idx) => idx !== index);
      const newPosition = Math.min(Math.max(0, newOrder - 1), currentSigners.length - 1);
      remainingSigners.splice(newPosition, 0, signer);

      const updatedSigners = remainingSigners.map((s, idx) => ({
        ...s,
        signingOrder: !canRecipientBeModified(s.nativeId) ? s.signingOrder : idx + 1,
      }));

      form.setValue('signers', updatedSigners, {
        shouldValidate: true,
        shouldDirty: true,
      });

      if (signer.role === RecipientRole.ASSISTANT && newPosition === remainingSigners.length - 1) {
        toast({
          title: _(msg`Warning: Assistant as last signer`),
          description: _(
            msg`Having an assistant as the last signer means they will be unable to take any action as there are no subsequent signers to assist.`,
          ),
        });
      }
    },
    [form, canRecipientBeModified, toast],
  );

  const handleSigningOrderDisable = useCallback(() => {
    setShowSigningOrderConfirmation(false);

    const currentSigners = form.getValues('signers');
    const updatedSigners = currentSigners.map((signer) => ({
      ...signer,
      role: signer.role === RecipientRole.ASSISTANT ? RecipientRole.SIGNER : signer.role,
    }));

    form.setValue('signers', updatedSigners, {
      shouldValidate: true,
      shouldDirty: true,
    });
    form.setValue('signingOrder', DocumentSigningOrder.PARALLEL, {
      shouldValidate: true,
      shouldDirty: true,
    });
    form.setValue('allowDictateNextSigner', false, {
      shouldValidate: true,
      shouldDirty: true,
    });

    void handleAutoSave();
  }, [form]);

  return (
    <>
      <DocumentFlowFormContainerHeader
        title={documentFlow.title}
        description={documentFlow.description}
      />
      <DocumentFlowFormContainerContent>
        {isDocumentPdfLoaded && (
          <DocumentReadOnlyFields
            showRecipientColors={true}
            recipientIds={recipients.map((recipient) => recipient.id)}
            fields={mapFieldsWithRecipients(fields, recipients)}
          />
        )}

        <AnimateGenericFadeInOut motionKey={showAdvancedSettings ? 'Show' : 'Hide'}>
          <Form {...form}>
            <FormField
              control={form.control}
              name="signingOrder"
              render={({ field }) => (
                <FormItem className="mb-6 flex flex-row items-center space-x-2 space-y-0">
                  <FormControl>
                    <Checkbox
                      {...field}
                      id="signingOrder"
                      checked={field.value === DocumentSigningOrder.SEQUENTIAL}
                      onCheckedChange={(checked) => {
                        if (!checked && hasAssistantRole) {
                          setShowSigningOrderConfirmation(true);
                          return;
                        }

                        field.onChange(
                          checked ? DocumentSigningOrder.SEQUENTIAL : DocumentSigningOrder.PARALLEL,
                        );

                        // If sequential signing is turned off, disable dictate next signer
                        if (!checked) {
                          form.setValue('allowDictateNextSigner', false, {
                            shouldValidate: true,
                            shouldDirty: true,
                          });
                        }

                        void handleAutoSave();
                      }}
                      disabled={isSubmitting || hasDocumentBeenSent || emptySigners().length !== 0}
                    />
                  </FormControl>

                  <div className="flex items-center text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    <FormLabel
                      htmlFor="signingOrder"
                      className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      <Trans>Enable signing order</Trans>
                    </FormLabel>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-muted-foreground ml-1 cursor-help">
                          <HelpCircle className="h-3.5 w-3.5" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-80 p-4">
                        <p>
                          <Trans>Add 2 or more signers to enable signing order.</Trans>
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="allowDictateNextSigner"
              render={({ field: { value, ...field } }) => (
                <FormItem className="mb-6 flex flex-row items-center space-x-2 space-y-0">
                  <FormControl>
                    <Checkbox
                      {...field}
                      id="allowDictateNextSigner"
                      checked={value}
                      onCheckedChange={(checked) => {
                        field.onChange(checked);
                        void handleAutoSave();
                      }}
                      disabled={isSubmitting || hasDocumentBeenSent || !isSigningOrderSequential}
                    />
                  </FormControl>

                  <div className="flex items-center text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    <FormLabel
                      htmlFor="allowDictateNextSigner"
                      className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      <Trans>Allow signers to dictate next signer</Trans>
                    </FormLabel>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-muted-foreground ml-1 cursor-help">
                          <HelpCircle className="h-3.5 w-3.5" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-80 p-4">
                        <p>
                          <Trans>
                            When enabled, signers can choose who should sign next in the sequence
                            instead of following the predefined order.
                          </Trans>
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </FormItem>
              )}
            />

            <DragDropContext
              onDragEnd={onDragEnd}
              sensors={[
                (api: SensorAPI) => {
                  $sensorApi.current = api;
                },
              ]}
            >
              <Droppable droppableId="signers">
                {(provided) => (
                  <div
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                    className="flex w-full flex-col gap-y-2"
                  >
                    {signers.map((signer, index) => (
                      <Draggable
                        key={`${signer.id}-${signer.signingOrder}`}
                        draggableId={signer.id}
                        index={index}
                        isDragDisabled={
                          !isSigningOrderSequential ||
                          isSubmitting ||
                          !canRecipientBeModified(signer.nativeId) ||
                          !signer.signingOrder
                        }
                      >
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className={cn('py-1', {
                              'bg-widget-foreground pointer-events-none rounded-md pt-2':
                                snapshot.isDragging,
                            })}
                          >
                            <motion.fieldset
                              data-native-id={signer.nativeId}
                              disabled={isSubmitting || !canRecipientBeModified(signer.nativeId)}
                              className={cn('grid grid-cols-10 items-end gap-2 pb-2', {
                                'border-b pt-2': showAdvancedSettings,
                                'grid-cols-12 pr-3': isSigningOrderSequential,
                              })}
                            >
                              {isSigningOrderSequential && (
                                <FormField
                                  control={form.control}
                                  name={`signers.${index}.signingOrder`}
                                  render={({ field }) => (
                                    <FormItem
                                      className={cn(
                                        'col-span-2 mt-auto flex items-center gap-x-1 space-y-0',
                                        {
                                          'mb-6':
                                            form.formState.errors.signers?.[index] &&
                                            !form.formState.errors.signers[index]?.signingOrder,
                                        },
                                      )}
                                    >
                                      <GripVerticalIcon className="h-5 w-5 flex-shrink-0 opacity-40" />
                                      <FormControl>
                                        <Input
                                          type="number"
                                          max={signers.length}
                                          data-testid="signing-order-input"
                                          className={cn(
                                            'w-full text-center',
                                            '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
                                          )}
                                          {...field}
                                          onChange={(e) => {
                                            field.onChange(e);
                                            handleSigningOrderChange(index, e.target.value);
                                            void handleAutoSave();
                                          }}
                                          onBlur={(e) => {
                                            field.onBlur();
                                            handleSigningOrderChange(index, e.target.value);
                                            void handleAutoSave();
                                          }}
                                          disabled={
                                            snapshot.isDragging ||
                                            isSubmitting ||
                                            !canRecipientBeModified(signer.nativeId)
                                          }
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              )}

                              <FormField
                                control={form.control}
                                name={`signers.${index}.email`}
                                render={({ field }) => (
                                  <FormItem
                                    className={cn('relative', {
                                      'mb-6':
                                        form.formState.errors.signers?.[index] &&
                                        !form.formState.errors.signers[index]?.email,
                                      'col-span-4': !showAdvancedSettings,
                                      'col-span-5': showAdvancedSettings,
                                    })}
                                  >
                                    {!showAdvancedSettings && (
                                      <FormLabel required>
                                        <Trans>Email</Trans>
                                      </FormLabel>
                                    )}

                                    <FormControl>
                                      <RecipientAutoCompleteInput
                                        type="email"
                                        placeholder={_(msg`Email`)}
                                        value={field.value}
                                        disabled={
                                          snapshot.isDragging ||
                                          isSubmitting ||
                                          !canRecipientBeModified(signer.nativeId)
                                        }
                                        options={recipientSuggestions}
                                        onSelect={(suggestion) =>
                                          handleRecipientAutoCompleteSelect(index, suggestion)
                                        }
                                        onSearchQueryChange={(query) => {
                                          field.onChange(query);
                                          setRecipientSearchQuery(query);
                                        }}
                                        loading={isLoading}
                                        data-testid="signer-email-input"
                                        maxLength={254}
                                        onBlur={handleAutoSave}
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
                                      'mb-6':
                                        form.formState.errors.signers?.[index] &&
                                        !form.formState.errors.signers[index]?.name,
                                      'col-span-4': !showAdvancedSettings,
                                      'col-span-5': showAdvancedSettings,
                                    })}
                                  >
                                    {!showAdvancedSettings && (
                                      <FormLabel>
                                        <Trans>Name</Trans>
                                      </FormLabel>
                                    )}

                                    <FormControl>
                                      <RecipientAutoCompleteInput
                                        type="text"
                                        placeholder={_(msg`Name`)}
                                        {...field}
                                        disabled={
                                          snapshot.isDragging ||
                                          isSubmitting ||
                                          !canRecipientBeModified(signer.nativeId)
                                        }
                                        options={recipientSuggestions}
                                        onSelect={(suggestion) =>
                                          handleRecipientAutoCompleteSelect(index, suggestion)
                                        }
                                        onSearchQueryChange={(query) => {
                                          field.onChange(query);
                                          setRecipientSearchQuery(query);
                                        }}
                                        loading={isLoading}
                                        maxLength={255}
                                        onBlur={handleAutoSave}
                                      />
                                    </FormControl>

                                    <FormMessage />
                                  </FormItem>
                                )}
                              />

                              {showAdvancedSettings &&
                                organisation.organisationClaim.flags.cfr21 && (
                                  <FormField
                                    control={form.control}
                                    name={`signers.${index}.actionAuth`}
                                    render={({ field }) => (
                                      <FormItem
                                        className={cn('col-span-8', {
                                          'mb-6':
                                            form.formState.errors.signers?.[index] &&
                                            !form.formState.errors.signers[index]?.actionAuth,
                                          'col-span-10': isSigningOrderSequential,
                                        })}
                                      >
                                        <FormControl>
                                          <RecipientActionAuthSelect
                                            {...field}
                                            onValueChange={field.onChange}
                                            disabled={
                                              snapshot.isDragging ||
                                              isSubmitting ||
                                              !canRecipientBeModified(signer.nativeId)
                                            }
                                          />
                                        </FormControl>

                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                )}

                              <div className="col-span-2 flex gap-x-2">
                                <FormField
                                  control={form.control}
                                  name={`signers.${index}.role`}
                                  render={({ field }) => (
                                    <FormItem
                                      className={cn('mt-auto', {
                                        'mb-6':
                                          form.formState.errors.signers?.[index] &&
                                          !form.formState.errors.signers[index]?.role,
                                      })}
                                    >
                                      <FormControl>
                                        <RecipientRoleSelect
                                          {...field}
                                          isAssistantEnabled={isSigningOrderSequential}
                                          onValueChange={(value) => {
                                            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
                                            handleRoleChange(index, value as RecipientRole);
                                            void handleAutoSave();
                                          }}
                                          disabled={
                                            snapshot.isDragging ||
                                            isSubmitting ||
                                            !canRecipientBeModified(signer.nativeId)
                                          }
                                        />
                                      </FormControl>

                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />

                                <button
                                  type="button"
                                  className={cn(
                                    'mt-auto inline-flex h-10 w-10 items-center justify-center hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50',
                                    {
                                      'mb-6': form.formState.errors.signers?.[index],
                                    },
                                  )}
                                  data-testid="remove-signer-button"
                                  disabled={
                                    snapshot.isDragging ||
                                    isSubmitting ||
                                    !canRecipientBeModified(signer.nativeId) ||
                                    signers.length === 1
                                  }
                                  onClick={() => onRemoveSigner(index)}
                                >
                                  <Trash className="h-4 w-4" />
                                </button>
                              </div>
                            </motion.fieldset>
                          </div>
                        )}
                      </Draggable>
                    ))}

                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>

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
                <Trans>Add Signer</Trans>
              </Button>

              <Button
                type="button"
                variant="secondary"
                className="dark:bg-muted dark:hover:bg-muted/80 bg-black/5 hover:bg-black/10"
                disabled={isSubmitting || isUserAlreadyARecipient}
                onClick={() => onAddSelfSigner()}
              >
                <Plus className="-ml-1 mr-2 h-5 w-5" />
                <Trans>Add myself</Trans>
              </Button>
            </div>

            {!alwaysShowAdvancedSettings && organisation.organisationClaim.flags.cfr21 && (
              <div className="mt-4 flex flex-row items-center">
                <Checkbox
                  id="showAdvancedRecipientSettings"
                  className="h-5 w-5"
                  checked={showAdvancedSettings}
                  onCheckedChange={(value) => setShowAdvancedSettings(Boolean(value))}
                />

                <label
                  className="text-muted-foreground ml-2 text-sm"
                  htmlFor="showAdvancedRecipientSettings"
                >
                  <Trans>Show advanced settings</Trans>
                </label>
              </div>
            )}
          </Form>
        </AnimateGenericFadeInOut>

        <SigningOrderConfirmation
          open={showSigningOrderConfirmation}
          onOpenChange={setShowSigningOrderConfirmation}
          onConfirm={handleSigningOrderDisable}
        />
      </DocumentFlowFormContainerContent>

      <DocumentFlowFormContainerFooter>
        <DocumentFlowFormContainerStep step={currentStep} maxStep={totalSteps} />

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
