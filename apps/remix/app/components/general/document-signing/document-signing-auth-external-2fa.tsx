import { useEffect, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { Trans } from '@lingui/react/macro';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { SIGNING_2FA_VERIFY_REASON_CODES } from '@documenso/lib/constants/document-auth';
import { AppError } from '@documenso/lib/errors/app-error';
import { DocumentAuth, type TRecipientActionAuth } from '@documenso/lib/types/document-auth';
import { trpc } from '@documenso/trpc/react';
import { Alert, AlertDescription, AlertTitle } from '@documenso/ui/primitives/alert';
import { Button } from '@documenso/ui/primitives/button';
import { DialogFooter } from '@documenso/ui/primitives/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@documenso/ui/primitives/form/form';
import { PinInput, PinInputGroup, PinInputSlot } from '@documenso/ui/primitives/pin-input';

import { useRequiredDocumentSigningAuthContext } from './document-signing-auth-provider';

export type DocumentSigningAuthExternal2FAProps = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  onReauthFormSubmit: (values?: TRecipientActionAuth) => Promise<void> | void;
};

const ZExternal2FAFormSchema = z.object({
  code: z
    .string()
    .length(6, { message: 'Code must be exactly 6 digits' })
    .regex(/^\d{6}$/, { message: 'Code must contain only digits' }),
});

type TExternal2FAFormSchema = z.infer<typeof ZExternal2FAFormSchema>;

export const DocumentSigningAuthExternal2FA = ({
  onReauthFormSubmit,
  open,
  onOpenChange,
}: DocumentSigningAuthExternal2FAProps) => {
  const { recipient, isCurrentlyAuthenticating, setIsCurrentlyAuthenticating } =
    useRequiredDocumentSigningAuthContext();

  const [formError, setFormError] = useState<string | null>(null);

  const statusQuery = trpc.envelope.signing2fa.getStatus.useQuery(
    { token: recipient.token },
    { enabled: open },
  );

  const verifyMutation = trpc.envelope.signing2fa.verify.useMutation();

  const form = useForm<TExternal2FAFormSchema>({
    resolver: zodResolver(ZExternal2FAFormSchema),
    defaultValues: {
      code: '',
    },
  });

  const onFormSubmit = async ({ code }: TExternal2FAFormSchema) => {
    try {
      setIsCurrentlyAuthenticating(true);
      setFormError(null);

      await verifyMutation.mutateAsync({
        token: recipient.token,
        code,
      });

      await onReauthFormSubmit({
        type: DocumentAuth.EXTERNAL_TWO_FACTOR_AUTH,
      });

      onOpenChange(false);
    } catch (err) {
      const error = AppError.parseError(err);

      if (error.message === SIGNING_2FA_VERIFY_REASON_CODES.TWO_FA_ATTEMPT_LIMIT_REACHED) {
        setFormError('Too many failed attempts. Please request a new code.');
      } else if (error.message === SIGNING_2FA_VERIFY_REASON_CODES.TWO_FA_TOKEN_EXPIRED) {
        setFormError('The code has expired. Please request a new code.');
      } else if (error.message === SIGNING_2FA_VERIFY_REASON_CODES.TWO_FA_NOT_ISSUED) {
        setFormError('No code has been issued yet. Please contact the document sender.');
      } else {
        setFormError('Invalid code. Please try again.');
      }

      await statusQuery.refetch();
      form.reset({ code: '' });
    } finally {
      setIsCurrentlyAuthenticating(false);
    }
  };

  useEffect(() => {
    form.reset({ code: '' });
    setFormError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const attemptsRemaining = statusQuery.data?.attemptsRemaining ?? null;
  const hasActiveToken = statusQuery.data?.hasActiveToken ?? false;
  const hasValidProof = statusQuery.data?.hasValidProof ?? false;

  if (hasValidProof) {
    return (
      <div className="space-y-4">
        <Alert>
          <AlertDescription>
            <Trans>Your identity has already been verified. You can proceed to sign.</Trans>
          </AlertDescription>
        </Alert>
        <DialogFooter>
          <Button
            type="button"
            onClick={async () => {
              await onReauthFormSubmit({
                type: DocumentAuth.EXTERNAL_TWO_FACTOR_AUTH,
              });
              onOpenChange(false);
            }}
          >
            <Trans>Continue</Trans>
          </Button>
        </DialogFooter>
      </div>
    );
  }

  if (!hasActiveToken && !statusQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Alert variant="warning">
          <AlertTitle>
            <Trans>Verification code required</Trans>
          </AlertTitle>
          <AlertDescription>
            <Trans>
              A verification code is required to sign this document. Please contact the document
              sender to request your code.
            </Trans>
          </AlertDescription>
        </Alert>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            <Trans>Close</Trans>
          </Button>
        </DialogFooter>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onFormSubmit)}>
        <fieldset disabled={isCurrentlyAuthenticating}>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              <Trans>Enter the 6-digit verification code that was provided to you.</Trans>
            </p>

            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>
                    <Trans>Verification code</Trans>
                  </FormLabel>

                  <FormControl>
                    <PinInput {...field} value={field.value ?? ''} maxLength={6}>
                      {Array(6)
                        .fill(null)
                        .map((_, i) => (
                          <PinInputGroup key={i}>
                            <PinInputSlot index={i} />
                          </PinInputGroup>
                        ))}
                    </PinInput>
                  </FormControl>

                  <FormMessage />
                </FormItem>
              )}
            />

            {attemptsRemaining !== null && attemptsRemaining > 0 && (
              <p className="text-xs text-muted-foreground">
                <Trans>{attemptsRemaining} attempts remaining</Trans>
              </p>
            )}

            {formError && (
              <Alert variant="destructive">
                <AlertTitle>
                  <Trans>Verification failed</Trans>
                </AlertTitle>
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            )}

            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
                <Trans>Cancel</Trans>
              </Button>

              <Button type="submit" loading={isCurrentlyAuthenticating}>
                <Trans>Verify</Trans>
              </Button>
            </DialogFooter>
          </div>
        </fieldset>
      </form>
    </Form>
  );
};
