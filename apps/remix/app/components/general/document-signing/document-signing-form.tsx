import { useId, useMemo, useState } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { type Field, FieldType, type Recipient, RecipientRole } from '@prisma/client';
import { Controller, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';

import { useAnalytics } from '@documenso/lib/client-only/hooks/use-analytics';
import { useOptionalSession } from '@documenso/lib/client-only/providers/session';
import type { DocumentAndSender } from '@documenso/lib/server-only/document/get-document-by-token';
import type { TRecipientActionAuth } from '@documenso/lib/types/document-auth';
import { isFieldUnsignedAndRequired } from '@documenso/lib/utils/advanced-fields-helpers';
import { sortFieldsByPosition, validateFieldsInserted } from '@documenso/lib/utils/fields';
import type { RecipientWithFields } from '@documenso/prisma/types/recipient-with-fields';
import { trpc } from '@documenso/trpc/react';
import { FieldToolTip } from '@documenso/ui/components/field/field-tooltip';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import { Card, CardContent } from '@documenso/ui/primitives/card';
import { Input } from '@documenso/ui/primitives/input';
import { Label } from '@documenso/ui/primitives/label';
import { RadioGroup, RadioGroupItem } from '@documenso/ui/primitives/radio-group';
import { SignaturePad } from '@documenso/ui/primitives/signature-pad';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { AssistantConfirmationDialog } from '../../dialogs/assistant-confirmation-dialog';
import { DocumentSigningCompleteDialog } from './document-signing-complete-dialog';
import { useRequiredDocumentSigningContext } from './document-signing-provider';

export type DocumentSigningFormProps = {
  document: DocumentAndSender;
  recipient: Recipient;
  fields: Field[];
  redirectUrl?: string | null;
  isRecipientsTurn: boolean;
  allRecipients?: RecipientWithFields[];
  setSelectedSignerId?: (id: number | null) => void;
};

export const DocumentSigningForm = ({
  document,
  recipient,
  fields,
  redirectUrl,
  isRecipientsTurn,
  allRecipients = [],
  setSelectedSignerId,
}: DocumentSigningFormProps) => {
  const { sessionData } = useOptionalSession();
  const user = sessionData?.user;

  const { _ } = useLingui();
  const { toast } = useToast();

  const navigate = useNavigate();
  const analytics = useAnalytics();

  const assistantSignersId = useId();

  const { fullName, signature, setFullName, setSignature, signatureValid, setSignatureValid } =
    useRequiredDocumentSigningContext();

  const [validateUninsertedFields, setValidateUninsertedFields] = useState(false);
  const [isConfirmationDialogOpen, setIsConfirmationDialogOpen] = useState(false);
  const [isAssistantSubmitting, setIsAssistantSubmitting] = useState(false);

  const { mutateAsync: completeDocumentWithToken } =
    trpc.recipient.completeDocumentWithToken.useMutation();

  const assistantForm = useForm<{ selectedSignerId: number | undefined }>({
    defaultValues: {
      selectedSignerId: undefined,
    },
  });

  const { handleSubmit, formState } = useForm();

  // Keep the loading state going if successful since the redirect may take some time.
  const isSubmitting = formState.isSubmitting || formState.isSubmitSuccessful;

  const fieldsRequiringValidation = useMemo(
    () => fields.filter(isFieldUnsignedAndRequired),
    [fields],
  );

  const hasSignatureField = fields.some((field) => field.type === FieldType.SIGNATURE);

  const uninsertedFields = useMemo(() => {
    return sortFieldsByPosition(fieldsRequiringValidation.filter((field) => !field.inserted));
  }, [fieldsRequiringValidation]);

  const uninsertedRecipientFields = useMemo(() => {
    return fieldsRequiringValidation.filter((field) => field.recipientId === recipient.id);
  }, [fieldsRequiringValidation, recipient]);

  const fieldsValidated = () => {
    setValidateUninsertedFields(true);
    validateFieldsInserted(fieldsRequiringValidation);
  };

  const onFormSubmit = async () => {
    setValidateUninsertedFields(true);

    const isFieldsValid = validateFieldsInserted(fieldsRequiringValidation);

    if (hasSignatureField && !signatureValid) {
      return;
    }

    if (!isFieldsValid) {
      return;
    }

    await completeDocument();
  };

  const onAssistantFormSubmit = () => {
    if (uninsertedRecipientFields.length > 0) {
      return;
    }

    setIsConfirmationDialogOpen(true);
  };

  const handleAssistantConfirmDialogSubmit = async () => {
    setIsAssistantSubmitting(true);

    try {
      await completeDocument();
    } catch (err) {
      toast({
        title: 'Error',
        description: 'An error occurred while completing the document. Please try again.',
        variant: 'destructive',
      });

      setIsAssistantSubmitting(false);
      setIsConfirmationDialogOpen(false);
    }
  };

  const completeDocument = async (authOptions?: TRecipientActionAuth) => {
    await completeDocumentWithToken({
      token: recipient.token,
      documentId: document.id,
      authOptions,
    });

    analytics.capture('App: Recipient has completed signing', {
      signerId: recipient.id,
      documentId: document.id,
      timestamp: new Date().toISOString(),
    });

    if (redirectUrl) {
      window.location.href = redirectUrl;
    } else {
      await navigate(`/sign/${recipient.token}/complete`);
    }
  };

  return (
    <div
      className={cn(
        'dark:bg-background border-border bg-widget sticky flex h-full flex-col rounded-xl border px-4 py-6',
        {
          'top-20 max-h-[min(68rem,calc(100vh-6rem))]': user,
          'top-4 max-h-[min(68rem,calc(100vh-2rem))]': !user,
        },
      )}
    >
      {validateUninsertedFields && uninsertedFields[0] && (
        <FieldToolTip key={uninsertedFields[0].id} field={uninsertedFields[0]} color="warning">
          <Trans>Click to insert field</Trans>
        </FieldToolTip>
      )}

      <div className="custom-scrollbar -mx-2 flex flex-1 flex-col overflow-y-auto overflow-x-hidden px-2">
        <div className="flex flex-1 flex-col">
          <h3 className="text-foreground text-2xl font-semibold">
            {recipient.role === RecipientRole.VIEWER && <Trans>View Document</Trans>}
            {recipient.role === RecipientRole.SIGNER && <Trans>Sign Document</Trans>}
            {recipient.role === RecipientRole.APPROVER && <Trans>Approve Document</Trans>}
            {recipient.role === RecipientRole.ASSISTANT && <Trans>Assist Document</Trans>}
          </h3>

          {recipient.role === RecipientRole.VIEWER ? (
            <>
              <p className="text-muted-foreground mt-2 text-sm">
                <Trans>Please mark as viewed to complete</Trans>
              </p>

              <hr className="border-border mb-8 mt-4" />

              <div className="-mx-2 flex flex-1 flex-col gap-4 overflow-y-auto px-2">
                <div className="flex flex-1 flex-col gap-y-4" />
                <div className="flex flex-col gap-4 md:flex-row">
                  <Button
                    type="button"
                    className="dark:bg-muted dark:hover:bg-muted/80 w-full bg-black/5 hover:bg-black/10"
                    variant="secondary"
                    size="lg"
                    disabled={typeof window !== 'undefined' && window.history.length <= 1}
                    onClick={async () => navigate(-1)}
                  >
                    <Trans>Cancel</Trans>
                  </Button>

                  <DocumentSigningCompleteDialog
                    isSubmitting={isSubmitting}
                    onSignatureComplete={handleSubmit(onFormSubmit)}
                    documentTitle={document.title}
                    fields={fields}
                    fieldsValidated={fieldsValidated}
                    role={recipient.role}
                    disabled={!isRecipientsTurn}
                  />
                </div>
              </div>
            </>
          ) : recipient.role === RecipientRole.ASSISTANT ? (
            <>
              <form onSubmit={assistantForm.handleSubmit(onAssistantFormSubmit)}>
                <p className="text-muted-foreground mt-2 text-sm">
                  <Trans>
                    Complete the fields for the following signers. Once reviewed, they will inform
                    you if any modifications are needed.
                  </Trans>
                </p>

                <hr className="border-border my-4" />

                <fieldset className="dark:bg-background border-border rounded-2xl border bg-white p-3">
                  <Controller
                    name="selectedSignerId"
                    control={assistantForm.control}
                    rules={{ required: 'Please select a signer' }}
                    render={({ field }) => (
                      <RadioGroup
                        className="gap-0 space-y-3 shadow-none"
                        value={field.value?.toString()}
                        onValueChange={(value) => {
                          field.onChange(value);
                          setSelectedSignerId?.(Number(value));
                        }}
                      >
                        {allRecipients
                          .filter((r) => r.fields.length > 0)
                          .map((r) => (
                            <div
                              key={`${assistantSignersId}-${r.id}`}
                              className="bg-widget border-border relative flex flex-col gap-4 rounded-lg border p-4"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <RadioGroupItem
                                    id={`${assistantSignersId}-${r.id}`}
                                    value={r.id.toString()}
                                    className="after:absolute after:inset-0"
                                  />

                                  <div className="grid grow gap-1">
                                    <Label
                                      className="inline-flex items-start"
                                      htmlFor={`${assistantSignersId}-${r.id}`}
                                    >
                                      {r.name}

                                      {r.id === recipient.id && (
                                        <span className="text-muted-foreground ml-2">
                                          {_(msg`(You)`)}
                                        </span>
                                      )}
                                    </Label>
                                    <p className="text-muted-foreground text-xs">{r.email}</p>
                                  </div>
                                </div>
                                <div className="text-muted-foreground text-xs leading-[inherit]">
                                  {r.fields.length} {r.fields.length === 1 ? 'field' : 'fields'}
                                </div>
                              </div>
                            </div>
                          ))}
                      </RadioGroup>
                    )}
                  />
                </fieldset>

                <div className="mt-6 flex flex-col gap-4 md:flex-row">
                  <Button
                    type="submit"
                    className="w-full"
                    size="lg"
                    loading={isAssistantSubmitting}
                    disabled={isAssistantSubmitting || uninsertedRecipientFields.length > 0}
                  >
                    {isAssistantSubmitting ? <Trans>Submitting...</Trans> : <Trans>Continue</Trans>}
                  </Button>
                </div>

                <AssistantConfirmationDialog
                  hasUninsertedFields={uninsertedFields.length > 0}
                  isOpen={isConfirmationDialogOpen}
                  onClose={() => !isAssistantSubmitting && setIsConfirmationDialogOpen(false)}
                  onConfirm={handleAssistantConfirmDialogSubmit}
                  isSubmitting={isAssistantSubmitting}
                />
              </form>
            </>
          ) : (
            <>
              <form onSubmit={handleSubmit(onFormSubmit)}>
                <p className="text-muted-foreground mt-2 text-sm">
                  <Trans>Please review the document before signing.</Trans>
                </p>

                <hr className="border-border mb-8 mt-4" />

                <fieldset
                  disabled={isSubmitting}
                  className="-mx-2 flex flex-1 flex-col gap-4 overflow-y-auto px-2"
                >
                  <div className="flex flex-1 flex-col gap-y-4">
                    <div>
                      <Label htmlFor="full-name">
                        <Trans>Full Name</Trans>
                      </Label>

                      <Input
                        type="text"
                        id="full-name"
                        className="bg-background mt-2"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value.trimStart())}
                      />
                    </div>

                    <div>
                      <Label htmlFor="Signature">
                        <Trans>Signature</Trans>
                      </Label>

                      <Card className="mt-2" gradient degrees={-120}>
                        <CardContent className="p-0">
                          <SignaturePad
                            className="h-44 w-full"
                            disabled={isSubmitting}
                            defaultValue={signature ?? undefined}
                            onValidityChange={(isValid) => {
                              setSignatureValid(isValid);
                            }}
                            onChange={(value) => {
                              if (signatureValid) {
                                setSignature(value);
                              }
                            }}
                            allowTypedSignature={document.documentMeta?.typedSignatureEnabled}
                          />
                        </CardContent>
                      </Card>

                      {hasSignatureField && !signatureValid && (
                        <div className="text-destructive mt-2 text-sm">
                          <Trans>
                            Signature is too small. Please provide a more complete signature.
                          </Trans>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-4 md:flex-row">
                    <Button
                      type="button"
                      className="dark:bg-muted dark:hover:bg-muted/80 w-full bg-black/5 hover:bg-black/10"
                      variant="secondary"
                      size="lg"
                      disabled={typeof window !== 'undefined' && window.history.length <= 1}
                      onClick={async () => navigate(-1)}
                    >
                      <Trans>Cancel</Trans>
                    </Button>

                    <DocumentSigningCompleteDialog
                      isSubmitting={isSubmitting}
                      onSignatureComplete={handleSubmit(onFormSubmit)}
                      documentTitle={document.title}
                      fields={fields}
                      fieldsValidated={fieldsValidated}
                      role={recipient.role}
                      disabled={!isRecipientsTurn}
                    />
                  </div>
                </fieldset>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
