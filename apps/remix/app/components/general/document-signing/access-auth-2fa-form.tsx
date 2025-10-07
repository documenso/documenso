import { useEffect, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { ArrowLeftIcon, KeyIcon, MailIcon } from 'lucide-react';
import { DateTime } from 'luxon';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import type { TRecipientAccessAuth } from '@documenso/lib/types/document-auth';
import { trpc } from '@documenso/trpc/react';
import { cn } from '@documenso/ui/lib/utils';
import { Alert } from '@documenso/ui/primitives/alert';
import { Button } from '@documenso/ui/primitives/button';
import { Form, FormField, FormItem } from '@documenso/ui/primitives/form/form';
import { PinInput, PinInputGroup, PinInputSlot } from '@documenso/ui/primitives/pin-input';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { useRequiredDocumentSigningAuthContext } from './document-signing-auth-provider';

type FormStep = 'method-selection' | 'code-input';
type TwoFactorMethod = 'email' | 'authenticator';

const ZAccessAuth2FAFormSchema = z.object({
  token: z.string().length(6, { message: 'Token must be 6 characters long' }),
});

type TAccessAuth2FAFormSchema = z.infer<typeof ZAccessAuth2FAFormSchema>;

export type AccessAuth2FAFormProps = {
  onSubmit: (accessAuthOptions: TRecipientAccessAuth) => void;
  token: string;
  error?: string | null;
};

export const AccessAuth2FAForm = ({ onSubmit, token, error }: AccessAuth2FAFormProps) => {
  const [step, setStep] = useState<FormStep>('method-selection');
  const [selectedMethod, setSelectedMethod] = useState<TwoFactorMethod | null>(null);

  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [millisecondsRemaining, setMillisecondsRemaining] = useState<number | null>(null);

  const { _ } = useLingui();
  const { toast } = useToast();

  const { user } = useRequiredDocumentSigningAuthContext();

  const { mutateAsync: request2FAEmail, isPending: isRequesting2FAEmail } =
    trpc.document.accessAuth.request2FAEmail.useMutation();

  const form = useForm({
    resolver: zodResolver(ZAccessAuth2FAFormSchema),
    defaultValues: {
      token: '',
    },
  });

  const hasAuthenticatorEnabled = user?.twoFactorEnabled === true;

  const onMethodSelect = async (method: TwoFactorMethod) => {
    setSelectedMethod(method);

    if (method === 'email') {
      try {
        const result = await request2FAEmail({
          token: token,
        });

        setExpiresAt(result.expiresAt);
        setMillisecondsRemaining(result.expiresAt.valueOf() - Date.now());

        setStep('code-input');
      } catch (error) {
        toast({
          title: _(msg`An error occurred`),
          description: _(
            msg`We encountered an unknown error while attempting to request the two-factor authentication code. Please try again later.`,
          ),
          variant: 'destructive',
        });

        return;
      }
    }

    setStep('code-input');
  };

  const onFormSubmit = (data: TAccessAuth2FAFormSchema) => {
    if (!selectedMethod) {
      return;
    }

    // Prepare the auth options for the completion attempt
    const accessAuthOptions: TRecipientAccessAuth = {
      type: 'TWO_FACTOR_AUTH',
      token: data.token, // Just the user's code - backend will validate using method type
      method: selectedMethod,
    };

    onSubmit(accessAuthOptions);
  };

  const onGoBack = () => {
    setStep('method-selection');
    setSelectedMethod(null);
    setExpiresAt(null);
    setMillisecondsRemaining(null);
  };

  const onResendEmail = async () => {
    if (selectedMethod !== 'email') {
      return;
    }

    try {
      const result = await request2FAEmail({
        token: token,
      });

      setExpiresAt(result.expiresAt);
      setMillisecondsRemaining(result.expiresAt.valueOf() - Date.now());
    } catch (error) {
      toast({
        title: _(msg`An error occurred`),
        description: _(
          msg`We encountered an unknown error while attempting to request the two-factor authentication code. Please try again later.`,
        ),
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      if (expiresAt) {
        setMillisecondsRemaining(expiresAt.valueOf() - Date.now());
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [expiresAt]);

  return (
    <div className="py-4">
      {step === 'method-selection' && (
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold">
              <Trans>Choose verification method</Trans>
            </h3>
            <p className="text-muted-foreground text-sm">
              <Trans>Please select how you'd like to receive your verification code.</Trans>
            </p>
          </div>

          {error && (
            <Alert variant="destructive" padding="tight" className="text-sm">
              {error}
            </Alert>
          )}

          <div className="space-y-3">
            <Button
              type="button"
              variant="outline"
              className="flex h-auto w-full justify-start gap-3 p-4"
              onClick={async () => onMethodSelect('email')}
              disabled={isRequesting2FAEmail}
            >
              <MailIcon className="h-5 w-5" />
              <div className="text-left">
                <div className="font-medium">
                  <Trans>Email verification</Trans>
                </div>
                <div className="text-muted-foreground text-sm">
                  <Trans>We'll send a 6-digit code to your email</Trans>
                </div>
              </div>
            </Button>

            {hasAuthenticatorEnabled && (
              <Button
                type="button"
                variant="outline"
                className="flex h-auto w-full justify-start gap-3 p-4"
                onClick={async () => onMethodSelect('authenticator')}
                disabled={isRequesting2FAEmail}
              >
                <KeyIcon className="h-5 w-5" />
                <div className="text-left">
                  <div className="font-medium">
                    <Trans>Authenticator app</Trans>
                  </div>
                  <div className="text-muted-foreground text-sm">
                    <Trans>Use your authenticator app to generate a code</Trans>
                  </div>
                </div>
              </Button>
            )}
          </div>
        </div>
      )}

      {step === 'code-input' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={onGoBack}>
              <ArrowLeftIcon className="h-4 w-4" />
            </Button>

            <h3 className="text-lg font-semibold">
              <Trans>Enter verification code</Trans>
            </h3>
          </div>

          <div className="text-muted-foreground text-sm">
            {selectedMethod === 'email' ? (
              <Trans>
                We've sent a 6-digit verification code to your email. Please enter it below to
                complete the document.
              </Trans>
            ) : (
              <Trans>
                Please open your authenticator app and enter the 6-digit code for this document.
              </Trans>
            )}
          </div>

          <Form {...form}>
            <form
              id="access-auth-2fa-form"
              className="space-y-4"
              onSubmit={form.handleSubmit(onFormSubmit)}
            >
              <fieldset disabled={isRequesting2FAEmail || form.formState.isSubmitting}>
                <FormField
                  control={form.control}
                  name="token"
                  render={({ field }) => (
                    <FormItem className="flex-1 items-center justify-center">
                      <PinInput
                        {...field}
                        maxLength={6}
                        autoFocus
                        inputMode="numeric"
                        pattern="^\d+$"
                        aria-label="2FA code"
                        containerClassName="h-12 justify-center"
                      >
                        <PinInputGroup>
                          <PinInputSlot className="h-12 w-12 text-lg" index={0} />
                          <PinInputSlot className="h-12 w-12 text-lg" index={1} />
                          <PinInputSlot className="h-12 w-12 text-lg" index={2} />
                          <PinInputSlot className="h-12 w-12 text-lg" index={3} />
                          <PinInputSlot className="h-12 w-12 text-lg" index={4} />
                          <PinInputSlot className="h-12 w-12 text-lg" index={5} />
                        </PinInputGroup>
                      </PinInput>

                      {expiresAt && millisecondsRemaining !== null && (
                        <div
                          className={cn('text-muted-foreground mt-2 text-center text-sm', {
                            'text-destructive': millisecondsRemaining <= 0,
                          })}
                        >
                          <Trans>
                            Expires in{' '}
                            {DateTime.fromMillis(Math.max(millisecondsRemaining, 0)).toFormat(
                              'mm:ss',
                            )}
                          </Trans>
                        </div>
                      )}
                    </FormItem>
                  )}
                />

                <div className="mt-4 space-y-2">
                  <Button
                    type="submit"
                    form="access-auth-2fa-form"
                    className="w-full"
                    disabled={!form.formState.isValid}
                    loading={isRequesting2FAEmail || form.formState.isSubmitting}
                  >
                    <Trans>Verify & Complete</Trans>
                  </Button>

                  {selectedMethod === 'email' && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="w-full"
                      onClick={onResendEmail}
                      loading={isRequesting2FAEmail}
                    >
                      <Trans>Resend code</Trans>
                    </Button>
                  )}
                </div>
              </fieldset>
            </form>
          </Form>
        </div>
      )}
    </div>
  );
};
