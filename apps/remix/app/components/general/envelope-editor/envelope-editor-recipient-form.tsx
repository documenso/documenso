import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';

import {
  DragDropContext,
  Draggable,
  type DropResult,
  Droppable,
  type SensorAPI,
} from '@hello-pangea/dnd';
import { zodResolver } from '@hookform/resolvers/zod';
import { msg } from '@lingui/core/macro';
import { Trans, useLingui } from '@lingui/react/macro';
import { DocumentSigningOrder, EnvelopeType, RecipientRole, SendStatus } from '@prisma/client';
import { motion } from 'framer-motion';
import { GripVerticalIcon, HelpCircleIcon, PlusIcon, SparklesIcon, TrashIcon } from 'lucide-react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { useSearchParams } from 'react-router';
import { isDeepEqual, prop, sortBy } from 'remeda';
import { z } from 'zod';

import { useLimits } from '@documenso/ee/server-only/limits/provider/client';
import { useDebouncedValue } from '@documenso/lib/client-only/hooks/use-debounced-value';
import { useCurrentEnvelopeEditor } from '@documenso/lib/client-only/providers/envelope-editor-provider';
import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { useSession } from '@documenso/lib/client-only/providers/session';
import type { TDetectedRecipientSchema } from '@documenso/lib/server-only/ai/envelope/detect-recipients/schema';
import {
  ZRecipientActionAuthTypesSchema,
  ZRecipientAuthOptionsSchema,
} from '@documenso/lib/types/document-auth';
import { nanoid } from '@documenso/lib/universal/id';
import { canRecipientBeModified as utilCanRecipientBeModified } from '@documenso/lib/utils/recipients';
import { trpc } from '@documenso/trpc/react';
import { AnimateGenericFadeInOut } from '@documenso/ui/components/animate/animate-generic-fade-in-out';
import { RecipientActionAuthSelect } from '@documenso/ui/components/recipient/recipient-action-auth-select';
import {
  RecipientAutoCompleteInput,
  type RecipientAutoCompleteOption,
} from '@documenso/ui/components/recipient/recipient-autocomplete-input';
import { RecipientRoleSelect } from '@documenso/ui/components/recipient/recipient-role-select';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@documenso/ui/primitives/card';
import { Checkbox } from '@documenso/ui/primitives/checkbox';
import { SigningOrderConfirmation } from '@documenso/ui/primitives/document-flow/signing-order-confirmation';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@documenso/ui/primitives/form/form';
import { FormErrorMessage } from '@documenso/ui/primitives/form/form-error-message';
import { Input } from '@documenso/ui/primitives/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@documenso/ui/primitives/tooltip';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { AiRecipientDetectionDialog } from '~/components/dialogs/ai-recipient-detection-dialog';
import { useCurrentTeam } from '~/providers/team';

const ZEnvelopeRecipientsForm = z.object({
  signers: z.array(
    z.object({
      formId: z.string().min(1),
      id: z.number().optional(),
      email: z
        .string()
        .email({ message: msg`Invalid email`.id })
        .min(1),
      name: z.string(),
      role: z.nativeEnum(RecipientRole),
      signingOrder: z.number().optional(),
      actionAuth: z.array(ZRecipientActionAuthTypesSchema).optional().default([]),
    }),
  ),
  signingOrder: z.nativeEnum(DocumentSigningOrder),
  allowDictateNextSigner: z.boolean().default(false),
});

type TEnvelopeRecipientsForm = z.infer<typeof ZEnvelopeRecipientsForm>;

export const EnvelopeEditorRecipientForm = () => {
  const { envelope, setRecipientsDebounced, updateEnvelope } = useCurrentEnvelopeEditor();

  const organisation = useCurrentOrganisation();
  const team = useCurrentTeam();

  const { t } = useLingui();
  const { toast } = useToast();
  const { remaining } = useLimits();
  const { user } = useSession();

  const [searchParams, setSearchParams] = useSearchParams();
  const [recipientSearchQuery, setRecipientSearchQuery] = useState('');

  // AI recipient detection dialog state
  const [isAiDialogOpen, setIsAiDialogOpen] = useState(() => searchParams.get('ai') === 'true');

  const onAiDialogOpenChange = (open: boolean) => {
    setIsAiDialogOpen(open);

    if (!open && searchParams.get('ai') === 'true') {
      setSearchParams(
        (prev) => {
          const newParams = new URLSearchParams(prev);

          newParams.delete('ai');

          return newParams;
        },
        { replace: true },
      );
    }
  };

  const debouncedRecipientSearchQuery = useDebouncedValue(recipientSearchQuery, 500);

  const initialId = useId();
  const $sensorApi = useRef<SensorAPI | null>(null);
  const isFirstRender = useRef(true);
  const { recipients, fields } = envelope;

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

  const form = useForm<TEnvelopeRecipientsForm>({
    resolver: zodResolver(ZEnvelopeRecipientsForm),
    mode: 'onChange', // Used for autosave purposes, maybe can try onBlur instead?
    defaultValues: {
      signers:
        recipients.length > 0
          ? sortBy(
              recipients.map((recipient, index) => ({
                id: recipient.id,
                formId: String(recipient.id),
                name: recipient.name,
                email: recipient.email,
                role: recipient.role,
                signingOrder: recipient.signingOrder ?? index + 1,
                actionAuth:
                  ZRecipientAuthOptionsSchema.parse(recipient.authOptions)?.actionAuth ?? undefined,
              })),
              [prop('signingOrder'), 'asc'],
              [prop('id'), 'asc'],
            )
          : defaultRecipients,
      signingOrder: envelope.documentMeta.signingOrder,
      allowDictateNextSigner: envelope.documentMeta.allowDictateNextSigner,
    },
  });

  const recipientHasAuthSettings = useMemo(() => {
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

  const [showAdvancedSettings, setShowAdvancedSettings] = useState(recipientHasAuthSettings);
  const [showSigningOrderConfirmation, setShowSigningOrderConfirmation] = useState(false);

  const {
    setValue,
    formState: { errors, isSubmitting },
    control,
    watch,
  } = form;

  const formValues = useWatch({
    control,
  });

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

  const {
    append: appendSigner,
    fields: signers,
    remove: removeSigner,
  } = useFieldArray({
    control,
    name: 'signers',
    keyName: 'nativeId',
  });

  const emptySigners = useCallback(
    () => form.getValues('signers').filter((signer) => signer.email === ''),
    [form],
  );

  const emptySignerIndex = watchedSigners.findIndex((signer) => !signer.name && !signer.email);
  const isUserAlreadyARecipient = watchedSigners.some(
    (signer) => signer.email.toLowerCase() === user?.email?.toLowerCase(),
  );

  const hasDocumentBeenSent = recipients.some(
    (recipient) => recipient.role !== RecipientRole.CC && recipient.sendStatus === SendStatus.SENT,
  );

  const canRecipientBeModified = (recipientId?: number) => {
    if (envelope.type === EnvelopeType.TEMPLATE) {
      return true;
    }

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

  const onAiDetectionComplete = (detectedRecipients: TDetectedRecipientSchema[]) => {
    const currentSigners = form.getValues('signers');

    let nextSigningOrder =
      currentSigners.length > 0
        ? Math.max(...currentSigners.map((s) => s.signingOrder ?? 0)) + 1
        : 1;

    // If the only signer is the default empty signer lets just replace it with the detected recipients
    if (currentSigners.length === 1 && !currentSigners[0].name && !currentSigners[0].email) {
      form.setValue(
        'signers',
        detectedRecipients.map((recipient, index) => ({
          formId: nanoid(12),
          name: recipient.name,
          email: recipient.email,
          role: recipient.role,
          actionAuth: [],
          signingOrder: index + 1,
        })),
        {
          shouldValidate: true,
          shouldDirty: true,
        },
      );

      return;
    }

    for (const recipient of detectedRecipients) {
      const emailExists = currentSigners.some(
        (s) => s.email.toLowerCase() === recipient.email.toLowerCase(),
      );

      const nameExists = currentSigners.some(
        (s) => s.name.toLowerCase() === recipient.name.toLowerCase(),
      );

      if ((emailExists && recipient.email) || (nameExists && recipient.name)) {
        continue;
      }

      currentSigners.push({
        formId: nanoid(12),
        name: recipient.name,
        email: recipient.email,
        role: recipient.role,
        actionAuth: [],
        signingOrder: nextSigningOrder,
      });

      nextSigningOrder += 1;
    }

    form.setValue('signers', normalizeSigningOrders(currentSigners), {
      shouldValidate: true,
      shouldDirty: true,
    });

    toast({
      title: t`Recipients added`,
      description: t`${detectedRecipients.length} recipient(s) have been added from AI detection.`,
    });
  };

  const onRemoveSigner = (index: number) => {
    const signer = signers[index];

    if (!canRecipientBeModified(signer.id)) {
      toast({
        title: t`Cannot remove signer`,
        description: t`This signer has already signed the document.`,
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
      while (insertIndex < items.length && !canRecipientBeModified(items[insertIndex].id)) {
        insertIndex++;
      }

      items.splice(insertIndex, 0, reorderedSigner);

      const updatedSigners = items.map((signer, index) => ({
        ...signer,
        signingOrder: !canRecipientBeModified(signer.id) ? signer.signingOrder : index + 1,
      }));

      form.setValue('signers', updatedSigners, {
        shouldValidate: true,
        shouldDirty: true,
      });

      const lastSigner = updatedSigners[updatedSigners.length - 1];
      if (lastSigner.role === RecipientRole.ASSISTANT) {
        toast({
          title: t`Warning: Assistant as last signer`,
          description: t`Having an assistant as the last signer means they will be unable to take any action as there are no subsequent signers to assist.`,
        });
      }

      await form.trigger('signers');
    },
    [form, canRecipientBeModified, watchedSigners, toast],
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
          title: t`Signing order is enabled.`,
          description: t`You cannot add assistants when signing order is disabled.`,
          variant: 'destructive',
        });
        return;
      }

      const updatedSigners = currentSigners.map((signer, idx) => ({
        ...signer,
        role: idx === index ? role : signer.role,
        signingOrder: !canRecipientBeModified(signer.id) ? signer.signingOrder : idx + 1,
      }));

      form.setValue('signers', updatedSigners, {
        shouldValidate: true,
        shouldDirty: true,
      });

      if (role === RecipientRole.ASSISTANT && index === updatedSigners.length - 1) {
        toast({
          title: t`Warning: Assistant as last signer`,
          description: t`Having an assistant as the last signer means they will be unable to take any action as there are no subsequent signers to assist.`,
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
        signingOrder: !canRecipientBeModified(s.id) ? s.signingOrder : idx + 1,
      }));

      form.setValue('signers', updatedSigners, {
        shouldValidate: true,
        shouldDirty: true,
      });

      if (signer.role === RecipientRole.ASSISTANT && newPosition === remainingSigners.length - 1) {
        toast({
          title: t`Warning: Assistant as last signer`,
          description: t`Having an assistant as the last signer means they will be unable to take any action as there are no subsequent signers to assist.`,
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

    void form.trigger();
  }, [form]);

  // Dupecode/Inefficient: Done because native isValid won't work for our usecase.
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    const formValueSigners = formValues.signers || [];

    // Remove the last signer if it's empty.
    const nonEmptyRecipients = formValueSigners.filter((signer, i) => {
      if (i === formValueSigners.length - 1 && signer.email === '') {
        return false;
      }

      return true;
    });

    const validatedFormValues = ZEnvelopeRecipientsForm.safeParse({
      ...formValues,
      signers: nonEmptyRecipients,
    });

    if (!validatedFormValues.success) {
      return;
    }

    const { data } = validatedFormValues;

    // Weird edge case where the whole envelope is created via API
    // with no signing order. If they come to this page it will show an error
    // since they aren't equal and the recipient is no longer editable.
    const envelopeRecipients = data.signers.map((recipient) => {
      if (!canRecipientBeModified(recipient.id)) {
        return {
          ...recipient,
          signingOrder: recipient.signingOrder,
        };
      }
      return recipient;
    });

    const hasSigningOrderChanged = envelope.documentMeta.signingOrder !== data.signingOrder;
    const hasAllowDictateNextSignerChanged =
      envelope.documentMeta.allowDictateNextSigner !== data.allowDictateNextSigner;

    const hasSignersChanged =
      envelopeRecipients.length !== recipients.length ||
      envelopeRecipients.some((signer) => {
        const recipient = recipients.find((recipient) => recipient.id === signer.id);

        if (!recipient) {
          return true;
        }

        const signerActionAuth = signer.actionAuth;
        const recipientActionAuth = recipient.authOptions?.actionAuth || [];

        return (
          signer.email !== recipient.email ||
          signer.name !== recipient.name ||
          signer.role !== recipient.role ||
          signer.signingOrder !== recipient.signingOrder ||
          !isDeepEqual(signerActionAuth, recipientActionAuth)
        );
      });

    if (hasSignersChanged) {
      setRecipientsDebounced(envelopeRecipients);
    }

    if (hasSigningOrderChanged || hasAllowDictateNextSignerChanged) {
      updateEnvelope({
        meta: {
          signingOrder: validatedFormValues.data.signingOrder,
          allowDictateNextSigner: validatedFormValues.data.allowDictateNextSigner,
        },
      });
    }
  }, [formValues]);

  return (
    <Card backdropBlur={false} className="border">
      <CardHeader className="flex flex-row justify-between">
        <div>
          <CardTitle>Recipients</CardTitle>
          <CardDescription className="mt-1.5">Add recipients to your document</CardDescription>
        </div>

        <div className="flex flex-row items-center space-x-2">
          {team.preferences.aiFeaturesEnabled && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  type="button"
                  size="sm"
                  disabled={isSubmitting}
                  onClick={() => setIsAiDialogOpen(true)}
                >
                  <SparklesIcon className="h-4 w-4" />
                </Button>
              </TooltipTrigger>

              <TooltipContent>
                <Trans>Detect recipients with AI</Trans>
              </TooltipContent>
            </Tooltip>
          )}

          <Button
            variant="outline"
            className="flex flex-row items-center"
            size="sm"
            disabled={isSubmitting || isUserAlreadyARecipient}
            onClick={() => onAddSelfSigner()}
          >
            <Trans>Add Myself</Trans>
          </Button>

          <Button
            variant="outline"
            type="button"
            className="flex-1"
            size="sm"
            disabled={isSubmitting || signers.length >= remaining.recipients}
            onClick={() => onAddSigner()}
          >
            <PlusIcon className="-ml-1 mr-1 h-5 w-5" />
            <Trans>Add Signer</Trans>
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        <AnimateGenericFadeInOut motionKey={showAdvancedSettings ? 'Show' : 'Hide'}>
          <Form {...form}>
            <div className="-mt-2 mb-2 space-y-4 rounded-md bg-accent/50 p-4">
              {organisation.organisationClaim.flags.cfr21 && (
                <div className="flex flex-row items-center">
                  <Checkbox
                    id="showAdvancedRecipientSettings"
                    checked={showAdvancedSettings}
                    onCheckedChange={(value) => setShowAdvancedSettings(Boolean(value))}
                  />

                  <label
                    className="ml-2 text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    htmlFor="showAdvancedRecipientSettings"
                  >
                    <Trans>Show advanced settings</Trans>
                  </label>
                </div>
              )}

              <FormField
                control={form.control}
                name="signingOrder"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center space-x-2 space-y-0">
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
                            checked
                              ? DocumentSigningOrder.SEQUENTIAL
                              : DocumentSigningOrder.PARALLEL,
                          );

                          // If sequential signing is turned off, disable dictate next signer
                          if (!checked) {
                            form.setValue('allowDictateNextSigner', false, {
                              shouldValidate: true,
                              shouldDirty: true,
                            });
                          }
                        }}
                        disabled={
                          isSubmitting || hasDocumentBeenSent || emptySigners().length !== 0
                        }
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
                          <span className="ml-1 cursor-help text-muted-foreground">
                            <HelpCircleIcon className="h-3.5 w-3.5" />
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

              {isSigningOrderSequential && (
                <FormField
                  control={form.control}
                  name="allowDictateNextSigner"
                  render={({ field: { value, ...field } }) => (
                    <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                      <FormControl>
                        <Checkbox
                          {...field}
                          id="allowDictateNextSigner"
                          checked={value}
                          onCheckedChange={(checked) => {
                            field.onChange(checked);
                          }}
                          disabled={
                            isSubmitting || hasDocumentBeenSent || !isSigningOrderSequential
                          }
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
                            <span className="ml-1 cursor-help text-muted-foreground">
                              <HelpCircleIcon className="h-3.5 w-3.5" />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-80 p-4">
                            <p>
                              <Trans>
                                When enabled, signers can choose who should sign next in the
                                sequence instead of following the predefined order.
                              </Trans>
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </FormItem>
                  )}
                />
              )}
            </div>

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
                        key={`${signer.nativeId}-${signer.signingOrder}`}
                        draggableId={signer['nativeId']}
                        index={index}
                        isDragDisabled={
                          !isSigningOrderSequential ||
                          isSubmitting ||
                          !canRecipientBeModified(signer.id) ||
                          !signer.signingOrder
                        }
                      >
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className={cn('py-1', {
                              'pointer-events-none rounded-md bg-widget-foreground pt-2':
                                snapshot.isDragging,
                            })}
                          >
                            <motion.fieldset
                              data-native-id={signer.id}
                              disabled={isSubmitting || !canRecipientBeModified(signer.id)}
                              className={cn('pb-2', {
                                'border-b pb-4':
                                  showAdvancedSettings && index !== signers.length - 1,
                                'pt-2': showAdvancedSettings && index === 0,
                                'pr-3': isSigningOrderSequential,
                              })}
                            >
                              <div className="flex flex-row items-center gap-x-2">
                                {isSigningOrderSequential && (
                                  <FormField
                                    control={form.control}
                                    name={`signers.${index}.signingOrder`}
                                    render={({ field }) => (
                                      <FormItem
                                        className={cn(
                                          'mt-auto flex items-center gap-x-1 space-y-0',
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
                                              'w-10 text-center',
                                              '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
                                            )}
                                            {...field}
                                            onChange={(e) => {
                                              field.onChange(e);
                                              handleSigningOrderChange(index, e.target.value);
                                            }}
                                            onBlur={(e) => {
                                              field.onBlur();
                                              handleSigningOrderChange(index, e.target.value);
                                            }}
                                            disabled={
                                              snapshot.isDragging ||
                                              isSubmitting ||
                                              !canRecipientBeModified(signer.id)
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
                                      className={cn('relative w-full', {
                                        'mb-6':
                                          form.formState.errors.signers?.[index] &&
                                          !form.formState.errors.signers[index]?.email,
                                      })}
                                    >
                                      {!showAdvancedSettings && index === 0 && (
                                        <FormLabel required>
                                          <Trans>Email</Trans>
                                        </FormLabel>
                                      )}

                                      <FormControl>
                                        <RecipientAutoCompleteInput
                                          type="email"
                                          placeholder={t`Email`}
                                          value={field.value}
                                          disabled={
                                            snapshot.isDragging ||
                                            isSubmitting ||
                                            !canRecipientBeModified(signer.id)
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
                                      className={cn('w-full', {
                                        'mb-6':
                                          form.formState.errors.signers?.[index] &&
                                          !form.formState.errors.signers[index]?.name,
                                      })}
                                    >
                                      {!showAdvancedSettings && index === 0 && (
                                        <FormLabel>
                                          <Trans>Name</Trans>
                                        </FormLabel>
                                      )}

                                      <FormControl>
                                        <RecipientAutoCompleteInput
                                          type="text"
                                          placeholder={t`Name`}
                                          {...field}
                                          disabled={
                                            snapshot.isDragging ||
                                            isSubmitting ||
                                            !canRecipientBeModified(signer.id)
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
                                        />
                                      </FormControl>

                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />

                                <FormField
                                  control={form.control}
                                  name={`signers.${index}.role`}
                                  render={({ field }) => (
                                    <FormItem
                                      className={cn('mt-auto w-fit', {
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
                                            field.onChange(value);
                                          }}
                                          disabled={
                                            snapshot.isDragging ||
                                            isSubmitting ||
                                            !canRecipientBeModified(signer.id)
                                          }
                                        />
                                      </FormControl>

                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />

                                <Button
                                  variant="ghost"
                                  className={cn('mt-auto px-2', {
                                    'mb-6': form.formState.errors.signers?.[index],
                                  })}
                                  data-testid="remove-signer-button"
                                  disabled={
                                    snapshot.isDragging ||
                                    isSubmitting ||
                                    !canRecipientBeModified(signer.id) ||
                                    signers.length === 1
                                  }
                                  onClick={() => onRemoveSigner(index)}
                                >
                                  <TrashIcon className="h-4 w-4" />
                                </Button>
                              </div>

                              {showAdvancedSettings &&
                                organisation.organisationClaim.flags.cfr21 && (
                                  <FormField
                                    control={form.control}
                                    name={`signers.${index}.actionAuth`}
                                    render={({ field }) => (
                                      <FormItem
                                        className={cn('mt-2 w-full', {
                                          'mb-6':
                                            form.formState.errors.signers?.[index] &&
                                            !form.formState.errors.signers[index]?.actionAuth,
                                          'pl-6': isSigningOrderSequential,
                                        })}
                                      >
                                        <FormControl>
                                          <RecipientActionAuthSelect
                                            {...field}
                                            onValueChange={field.onChange}
                                            disabled={
                                              snapshot.isDragging ||
                                              isSubmitting ||
                                              !canRecipientBeModified(signer.id)
                                            }
                                          />
                                        </FormControl>

                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                )}
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
          </Form>
        </AnimateGenericFadeInOut>

        <SigningOrderConfirmation
          open={showSigningOrderConfirmation}
          onOpenChange={setShowSigningOrderConfirmation}
          onConfirm={handleSigningOrderDisable}
        />

        <AiRecipientDetectionDialog
          open={isAiDialogOpen}
          onOpenChange={onAiDialogOpenChange}
          onComplete={onAiDetectionComplete}
          envelopeId={envelope.id}
          teamId={envelope.teamId}
        />
      </CardContent>
    </Card>
  );
};
