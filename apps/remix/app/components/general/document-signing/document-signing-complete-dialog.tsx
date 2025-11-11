import { useMemo, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { Trans, useLingui } from '@lingui/react/macro';
import type { Field, Recipient } from '@prisma/client';
import { RecipientRole } from '@prisma/client';
import { useForm } from 'react-hook-form';
import { match } from 'ts-pattern';
import { z } from 'zod';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import {
  type TRecipientAccessAuth,
  ZDocumentAccessAuthSchema,
} from '@documenso/lib/types/document-auth';
import { fieldsContainUnsignedRequiredField } from '@documenso/lib/utils/advanced-fields-helpers';
import { Button } from '@documenso/ui/primitives/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@documenso/ui/primitives/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@documenso/ui/primitives/form/form';
import { Input } from '@documenso/ui/primitives/input';

import { useEmbedSigningContext } from '~/components/embed/embed-signing-context';
import { AccessAuth2FAForm } from '~/components/general/document-signing/access-auth-2fa-form';
import { DocumentSigningDisclosure } from '~/components/general/document-signing/document-signing-disclosure';

import { useRequiredDocumentSigningAuthContext } from './document-signing-auth-provider';

export type DocumentSigningCompleteDialogProps = {
  isSubmitting: boolean;
  documentTitle: string;
  fields: Field[];
  fieldsValidated: () => void | Promise<void>;
  onSignatureComplete: (
    nextSigner?: { name: string; email: string },
    accessAuthOptions?: TRecipientAccessAuth,
    directRecipient?: { name: string; email: string },
  ) => void | Promise<void>;
  recipient: Pick<Recipient, 'name' | 'email' | 'role' | 'token'>;
  disabled?: boolean;
  allowDictateNextSigner?: boolean;
  defaultNextSigner?: {
    name: string;
    email: string;
  };
  directTemplatePayload?: {
    name: string;
    email: string;
  };
  buttonSize?: 'sm' | 'lg';
  position?: 'start' | 'end' | 'center';
};

const ZNextSignerFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
  accessAuthOptions: ZDocumentAccessAuthSchema.optional(),
});

type TNextSignerFormSchema = z.infer<typeof ZNextSignerFormSchema>;

const ZDirectRecipientFormSchema = z.object({
  name: z.string(),
  email: z.string().email('Invalid email address'),
});

type TDirectRecipientFormSchema = z.infer<typeof ZDirectRecipientFormSchema>;

export const DocumentSigningCompleteDialog = ({
  isSubmitting,
  documentTitle,
  fields,
  fieldsValidated,
  onSignatureComplete,
  recipient,
  disabled = false,
  allowDictateNextSigner = false,
  directTemplatePayload,
  defaultNextSigner,
  buttonSize = 'lg',
  position,
}: DocumentSigningCompleteDialogProps) => {
  const { t } = useLingui();

  const [showDialog, setShowDialog] = useState(false);

  const [showTwoFactorForm, setShowTwoFactorForm] = useState(false);
  const [twoFactorValidationError, setTwoFactorValidationError] = useState<string | null>(null);

  const { derivedRecipientAccessAuth } = useRequiredDocumentSigningAuthContext();

  const { isNameLocked, isEmailLocked } = useEmbedSigningContext() || {};

  const form = useForm<TNextSignerFormSchema>({
    resolver: allowDictateNextSigner ? zodResolver(ZNextSignerFormSchema) : undefined,
    defaultValues: {
      name: defaultNextSigner?.name ?? '',
      email: defaultNextSigner?.email ?? '',
    },
  });

  const directRecipientForm = useForm<TDirectRecipientFormSchema>({
    resolver: zodResolver(ZDirectRecipientFormSchema),
    defaultValues: {
      name: directTemplatePayload?.name ?? '',
      email: directTemplatePayload?.email ?? '',
    },
  });

  const isComplete = useMemo(() => !fieldsContainUnsignedRequiredField(fields), [fields]);

  const completionRequires2FA = useMemo(
    () => derivedRecipientAccessAuth.includes('TWO_FACTOR_AUTH'),
    [derivedRecipientAccessAuth],
  );

  const handleOpenChange = (open: boolean) => {
    if (form.formState.isSubmitting || !isComplete) {
      return;
    }

    if (open) {
      form.reset({
        name: defaultNextSigner?.name ?? '',
        email: defaultNextSigner?.email ?? '',
      });
    }

    setShowDialog(open);
  };

  const onFormSubmit = async (data: TNextSignerFormSchema) => {
    try {
      let directRecipient: { name: string; email: string } | undefined;

      if (directTemplatePayload && !directTemplatePayload.email) {
        const isFormValid = await directRecipientForm.trigger();

        if (!isFormValid) {
          return;
        }

        directRecipient = directRecipientForm.getValues();
      }

      // Check if 2FA is required
      if (completionRequires2FA && !data.accessAuthOptions) {
        setShowTwoFactorForm(true);
        return;
      }

      const nextSigner =
        allowDictateNextSigner && data.name && data.email
          ? { name: data.name, email: data.email }
          : undefined;

      await onSignatureComplete(nextSigner, data.accessAuthOptions, directRecipient);
    } catch (error) {
      const err = AppError.parseError(error);

      if (AppErrorCode.TWO_FACTOR_AUTH_FAILED === err.code) {
        // This was a 2FA validation failure - show the 2FA dialog again with error
        form.setValue('accessAuthOptions', undefined);

        setTwoFactorValidationError('Invalid verification code. Please try again.');
        setShowTwoFactorForm(true);

        return;
      }
    }
  };

  const onTwoFactorFormSubmit = (validatedAuthOptions: TRecipientAccessAuth) => {
    form.setValue('accessAuthOptions', validatedAuthOptions);

    setShowTwoFactorForm(false);
    setTwoFactorValidationError(null);

    // Now trigger the form submission with auth options
    void form.handleSubmit(onFormSubmit)();
  };

  return (
    <Dialog open={showDialog} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          className="w-full"
          type="button"
          size={buttonSize}
          onClick={fieldsValidated}
          loading={isSubmitting}
          disabled={disabled}
        >
          {match({ isComplete, role: recipient.role })
            .with({ isComplete: false }, () => <Trans>Next Field</Trans>)
            .with({ isComplete: true, role: RecipientRole.APPROVER }, () => <Trans>Approve</Trans>)
            .with({ isComplete: true, role: RecipientRole.VIEWER }, () => (
              <Trans>Mark as viewed</Trans>
            ))
            .with({ isComplete: true }, () => <Trans>Complete</Trans>)
            .exhaustive()}
        </Button>
      </DialogTrigger>

      <DialogContent position={position}>
        <DialogHeader>
          <DialogTitle>
            <Trans>Are you sure?</Trans>
          </DialogTitle>
          <DialogDescription>
            <div className="text-muted-foreground max-w-[50ch]">
              {match(recipient.role)
                .with(RecipientRole.VIEWER, () => (
                  <span className="inline-flex flex-wrap">
                    <Trans>You are about to complete viewing the following document</Trans>
                  </span>
                ))
                .with(RecipientRole.SIGNER, () => (
                  <span className="inline-flex flex-wrap">
                    <Trans>You are about to complete signing the following document</Trans>
                  </span>
                ))
                .with(RecipientRole.APPROVER, () => (
                  <span className="inline-flex flex-wrap">
                    <Trans>You are about to complete approving the following document</Trans>
                  </span>
                ))
                .with(RecipientRole.ASSISTANT, () => (
                  <span className="inline-flex flex-wrap">
                    <Trans>You are about to complete assisting the following document</Trans>
                  </span>
                ))
                .with(RecipientRole.CC, () => null)
                .exhaustive()}
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="border-border bg-muted/50 rounded-lg border p-4 text-center">
          <p className="text-muted-foreground text-sm font-medium">{documentTitle}</p>
        </div>

        {!showTwoFactorForm && (
          <>
            <fieldset disabled={form.formState.isSubmitting} className="border-none p-0">
              {directTemplatePayload && !directTemplatePayload.email && (
                <Form {...directRecipientForm}>
                  <div className="mb-4 flex flex-col gap-4">
                    <div className="flex flex-col gap-4 md:flex-row">
                      <FormField
                        control={directRecipientForm.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem className="flex-1">
                            <FormLabel>
                              <Trans>Your Name</Trans>
                            </FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                className="mt-2"
                                placeholder={t`Enter your name`}
                                disabled={isNameLocked}
                              />
                            </FormControl>

                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={directRecipientForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem className="flex-1">
                            <FormLabel>
                              <Trans>Your Email</Trans>
                            </FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                type="email"
                                className="mt-2"
                                placeholder={t`Enter your email`}
                                disabled={!!field.value && isEmailLocked}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                </Form>
              )}

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onFormSubmit)}>
                  {allowDictateNextSigner && defaultNextSigner && (
                    <div className="mb-4 flex flex-col gap-4">
                      <div className="flex flex-col gap-4 md:flex-row">
                        <FormField
                          control={form.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem className="flex-1">
                              <FormLabel>
                                <Trans>Next Recipient Name</Trans>
                              </FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  className="mt-2"
                                  placeholder={t`Enter the next signer's name`}
                                />
                              </FormControl>

                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem className="flex-1">
                              <FormLabel>
                                <Trans>Next Recipient Email</Trans>
                              </FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  type="email"
                                  className="mt-2"
                                  placeholder={t`Enter the next signer's email`}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  )}

                  <DocumentSigningDisclosure />

                  <DialogFooter className="mt-4">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setShowDialog(false)}
                      disabled={form.formState.isSubmitting}
                    >
                      <Trans>Cancel</Trans>
                    </Button>

                    <Button
                      type="submit"
                      disabled={!isComplete}
                      loading={form.formState.isSubmitting}
                    >
                      {match(recipient.role)
                        .with(RecipientRole.VIEWER, () => <Trans>Mark as Viewed</Trans>)
                        .with(RecipientRole.SIGNER, () => <Trans>Sign</Trans>)
                        .with(RecipientRole.APPROVER, () => <Trans>Approve</Trans>)
                        .with(RecipientRole.CC, () => <Trans>Mark as Viewed</Trans>)
                        .with(RecipientRole.ASSISTANT, () => <Trans>Complete</Trans>)
                        .exhaustive()}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </fieldset>
          </>
        )}

        {showTwoFactorForm && (
          <AccessAuth2FAForm
            token={recipient.token}
            error={twoFactorValidationError}
            onSubmit={onTwoFactorFormSubmit}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};
