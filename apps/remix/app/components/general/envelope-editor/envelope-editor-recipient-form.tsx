import { useLimits } from '@documenso/ee/server-only/limits/provider/client';
import { ZEditorRecipientsFormSchema } from '@documenso/lib/client-only/hooks/use-editor-recipients';
import { useCurrentEnvelopeEditor } from '@documenso/lib/client-only/providers/envelope-editor-provider';
import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { useOptionalSession } from '@documenso/lib/client-only/providers/session';
import type { TDetectedRecipientSchema } from '@documenso/lib/server-only/ai/envelope/detect-recipients/schema';
import { ZRecipientAuthOptionsSchema } from '@documenso/lib/types/document-auth';
import { nanoid } from '@documenso/lib/universal/id';
import { groupRecipientsBySigningOrder, normalizeGroupedSigningOrders } from '@documenso/lib/utils/recipient-groups';
import { canEditorRecipientBeModified } from '@documenso/lib/utils/recipients';
import { cn } from '@documenso/ui/lib/utils';
import { Alert, AlertDescription } from '@documenso/ui/primitives/alert';
import { Button } from '@documenso/ui/primitives/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@documenso/ui/primitives/card';
import { Checkbox } from '@documenso/ui/primitives/checkbox';
import { SigningOrderConfirmation } from '@documenso/ui/primitives/document-flow/signing-order-confirmation';
import { Form, FormControl, FormField, FormItem, FormLabel } from '@documenso/ui/primitives/form/form';
import { FormErrorMessage } from '@documenso/ui/primitives/form/form-error-message';
import { Tooltip, TooltipContent, TooltipTrigger } from '@documenso/ui/primitives/tooltip';
import { useToast } from '@documenso/ui/primitives/use-toast';
import { plural } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { DocumentSigningOrder, RecipientRole, SendStatus } from '@prisma/client';
import { HelpCircleIcon, PlusIcon, SparklesIcon } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFieldArray, useWatch } from 'react-hook-form';
import { useRevalidator, useSearchParams } from 'react-router';
import { isDeepEqual } from 'remeda';

import { AiFeaturesEnableDialog } from '~/components/dialogs/ai-features-enable-dialog';
import { AiRecipientDetectionDialog } from '~/components/dialogs/ai-recipient-detection-dialog';
import { useCurrentTeam } from '~/providers/team';

import { RecipientStepList } from './recipient-step-list';

export const EnvelopeEditorRecipientForm = () => {
  const { envelope, setRecipientsDebounced, updateEnvelope, editorRecipients, isEmbedded, editorConfig } =
    useCurrentEnvelopeEditor();

  const organisation = useCurrentOrganisation();
  const team = useCurrentTeam();

  const { toast } = useToast();
  const { remaining } = useLimits();
  const { sessionData } = useOptionalSession();

  const user = sessionData?.user;

  const [searchParams, setSearchParams] = useSearchParams();
  const [isAiEnableDialogOpen, setIsAiEnableDialogOpen] = useState(false);

  // AI recipient detection dialog state
  const [isAiDialogOpen, setIsAiDialogOpen] = useState(() => searchParams.get('ai') === 'true');
  const { revalidate } = useRevalidator();

  const onAiDialogOpenChange = (open: boolean) => {
    if (open && !team.preferences.aiFeaturesEnabled) {
      setIsAiEnableDialogOpen(true);
      setIsAiDialogOpen(false);
      return;
    }

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

  const onDetectRecipientsClick = () => {
    if (!team.preferences.aiFeaturesEnabled) {
      setIsAiEnableDialogOpen(true);
      return;
    }

    setIsAiDialogOpen(true);
  };

  const onAiFeaturesEnabled = () => {
    void revalidate().then(() => {
      setIsAiEnableDialogOpen(false);
      setIsAiDialogOpen(true);
    });
  };

  const isFirstRender = useRef(true);
  const { recipients } = envelope;

  const { form } = editorRecipients;

  const recipientHasAuthSettings = useMemo(() => {
    const recipientHasAuthOptions = recipients.find((recipient) => {
      const recipientAuthOptions = ZRecipientAuthOptionsSchema.parse(recipient.authOptions);

      return recipientAuthOptions.accessAuth.length > 0 || recipientAuthOptions.actionAuth.length > 0;
    });

    const formHasActionAuth = form.getValues('signers').find((signer) => signer.actionAuth.length > 0);

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
    return normalizeGroupedSigningOrders(signers, (signer) => canRecipientBeModified(signer.id));
  };

  // Keep a mounted field array for `signers` so react-hook-form reconciles
  // whole-array `setValue` calls atomically. Without it, reordering the array
  // leaves stale partial entries in watched values (missing email/name/role),
  // which breaks validation and the autosave sync.
  useFieldArray({
    control,
    name: 'signers',
  });

  const stepCount = useMemo(() => groupRecipientsBySigningOrder(watchedSigners).steps.length, [watchedSigners]);

  const emptySignerIndex = watchedSigners.findIndex(
    (signer) =>
      !signer.name && !signer.email && envelope.fields.filter((field) => field.recipientId === signer.id).length === 0,
  );

  const currentEditorEmail = isEmbedded ? editorConfig.embedded?.user?.email : user?.email;

  const currentEditorName = isEmbedded ? editorConfig.embedded?.user?.name : user?.name;

  const hasCurrentEditorInfo = Boolean(currentEditorEmail || currentEditorName);

  // Note: Watched signer entries can be transiently partial while react-hook-form
  // re-registers reordered array fields, so guard optional access here.
  const isUserAlreadyARecipient = watchedSigners.some(
    (signer) => Boolean(currentEditorEmail) && signer.email?.toLowerCase() === currentEditorEmail?.toLowerCase(),
  );

  const hasDocumentBeenSent = recipients.some(
    (recipient) => recipient.role !== RecipientRole.CC && recipient.sendStatus === SendStatus.SENT,
  );

  const canRecipientBeModified = (recipientId?: number) => canEditorRecipientBeModified(envelope, recipientId);

  const appendNormalizedSigner = (signer: (typeof watchedSigners)[number], shouldFocus = false) => {
    const updatedSigners = normalizeSigningOrders([...form.getValues('signers'), signer]);

    form.setValue('signers', updatedSigners, {
      shouldValidate: true,
      shouldDirty: true,
    });

    if (shouldFocus) {
      const signerIndex = updatedSigners.findIndex((updatedSigner) => updatedSigner.formId === signer.formId);

      if (signerIndex !== -1) {
        requestAnimationFrame(() => form.setFocus(`signers.${signerIndex}.email`));
      }
    }
  };

  const onAddSigner = () => {
    appendNormalizedSigner({
      formId: nanoid(12),
      name: '',
      email: '',
      role: RecipientRole.SIGNER,
      actionAuth: [],
      signingOrder: stepCount + 1,
    });
  };

  const onAiDetectionComplete = (detectedRecipients: TDetectedRecipientSchema[]) => {
    const currentSigners = form.getValues('signers');

    let nextSigningOrder =
      currentSigners.length > 0 ? Math.max(...currentSigners.map((s) => s.signingOrder ?? 0)) + 1 : 1;

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
      const emailExists = currentSigners.some((s) => s.email.toLowerCase() === recipient.email.toLowerCase());

      const nameExists = currentSigners.some((s) => s.name.toLowerCase() === recipient.name.toLowerCase());

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
      title: plural(detectedRecipients.length, {
        one: `Recipient added`,
        other: `Recipients added`,
      }),
      description: plural(detectedRecipients.length, {
        one: `# recipient have been added from AI detection.`,
        other: `# recipients have been added from AI detection.`,
      }),
    });
  };

  const onAddSelfSigner = () => {
    if (emptySignerIndex !== -1) {
      setValue(`signers.${emptySignerIndex}.name`, currentEditorName ?? '', {
        shouldValidate: true,
        shouldDirty: true,
      });
      setValue(`signers.${emptySignerIndex}.email`, currentEditorEmail ?? '', {
        shouldValidate: true,
        shouldDirty: true,
      });

      form.setFocus(`signers.${emptySignerIndex}.email`);
    } else {
      appendNormalizedSigner(
        {
          formId: nanoid(12),
          name: currentEditorName ?? '',
          email: currentEditorEmail ?? '',
          role: RecipientRole.SIGNER,
          actionAuth: [],
          signingOrder: stepCount + 1,
        },
        true,
      );

      void form.trigger('signers');
    }
  };

  const handleSigningOrderDisable = useCallback(() => {
    setShowSigningOrderConfirmation(false);

    const currentSigners = form.getValues('signers');
    const updatedSigners = normalizeSigningOrders(
      currentSigners.map((signer) => ({
        ...signer,
        role: signer.role === RecipientRole.ASSISTANT ? RecipientRole.SIGNER : signer.role,
      })),
    );

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

    const validatedFormValues = ZEditorRecipientsFormSchema.safeParse(formValues);

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

  const recipientCountLimit = organisation.organisationClaim.recipientCount;
  const isOverRecipientLimit = recipientCountLimit > 0 && watchedSigners.length > recipientCountLimit;

  return (
    <Card backdropBlur={false} className="border">
      <CardHeader className="flex flex-row justify-between">
        <div>
          <CardTitle>
            <Trans>Recipients</Trans>
          </CardTitle>
          <CardDescription className="mt-1.5">
            <Trans>Add recipients to your document</Trans>
          </CardDescription>
        </div>

        <div className="flex flex-row items-center space-x-2">
          {editorConfig.recipients?.allowAIDetection && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  type="button"
                  size="sm"
                  disabled={isSubmitting}
                  onClick={onDetectRecipientsClick}
                >
                  <SparklesIcon className="h-4 w-4" />
                </Button>
              </TooltipTrigger>

              <TooltipContent>
                {team.preferences.aiFeaturesEnabled ? (
                  <Trans>Detect recipients with AI</Trans>
                ) : (
                  <Trans>Enable AI detection</Trans>
                )}
              </TooltipContent>
            </Tooltip>
          )}

          {(!isEmbedded || hasCurrentEditorInfo) && (
            <Button
              variant="outline"
              className="flex flex-row items-center"
              size="sm"
              disabled={isSubmitting || isUserAlreadyARecipient}
              onClick={() => onAddSelfSigner()}
            >
              <Trans>Add Myself</Trans>
            </Button>
          )}

          <Button
            variant="outline"
            type="button"
            className="flex-1"
            size="sm"
            disabled={isSubmitting || watchedSigners.length >= remaining.recipients}
            onClick={() => onAddSigner()}
          >
            <PlusIcon className="mr-1 -ml-1 h-5 w-5" />
            <Trans>Add Signer</Trans>
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {isOverRecipientLimit && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>
              <Trans>
                This envelope cannot have more than {recipientCountLimit} recipients. Please contact support if you need
                more.
              </Trans>
            </AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <div
            className={cn('-mt-2 mb-2 space-y-4 rounded-md bg-accent/50 p-4', {
              hidden:
                !editorConfig.recipients?.allowConfigureSigningOrder && !organisation.organisationClaim.flags.cfr21,
            })}
          >
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

            {editorConfig.recipients?.allowConfigureSigningOrder && (
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

                          field.onChange(checked ? DocumentSigningOrder.SEQUENTIAL : DocumentSigningOrder.PARALLEL);

                          // If sequential signing is turned off, disable dictate next signer
                          if (!checked) {
                            form.setValue('allowDictateNextSigner', false, {
                              shouldValidate: true,
                              shouldDirty: true,
                            });
                          }
                        }}
                        disabled={isSubmitting || hasDocumentBeenSent}
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
            )}

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
                          <span className="ml-1 cursor-help text-muted-foreground">
                            <HelpCircleIcon className="h-3.5 w-3.5" />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-80 p-4">
                          <p>
                            <Trans>
                              When enabled, signers can choose who should sign next in the sequence instead of following
                              the predefined order.
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

          <RecipientStepList showAdvancedSettings={showAdvancedSettings} />

          <FormErrorMessage
            className="mt-2"
            // Dirty hack to handle errors when .root is populated for an array type
            error={'signers__root' in errors && errors['signers__root']}
          />
        </Form>

        <SigningOrderConfirmation
          open={showSigningOrderConfirmation}
          onOpenChange={setShowSigningOrderConfirmation}
          onConfirm={handleSigningOrderDisable}
        />

        {editorConfig.recipients?.allowAIDetection && (
          <AiRecipientDetectionDialog
            open={isAiDialogOpen}
            onOpenChange={onAiDialogOpenChange}
            onComplete={onAiDetectionComplete}
            envelopeId={envelope.id}
            teamId={envelope.teamId}
          />
        )}

        <AiFeaturesEnableDialog
          open={isAiEnableDialogOpen}
          onOpenChange={setIsAiEnableDialogOpen}
          onEnabled={onAiFeaturesEnabled}
        />
      </CardContent>
    </Card>
  );
};
