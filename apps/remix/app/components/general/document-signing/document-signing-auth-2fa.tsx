import { useEffect, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { Trans } from '@lingui/react/macro';
import { RecipientRole } from '@prisma/client';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

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
import { Tabs, TabsList, TabsTrigger } from '@documenso/ui/primitives/tabs';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { EnableAuthenticatorAppDialog } from '~/components/forms/2fa/enable-authenticator-app-dialog';

import { useRequiredDocumentSigningAuthContext } from './document-signing-auth-provider';

export type DocumentSigningAuth2FAProps = {
  actionTarget?: 'FIELD' | 'DOCUMENT';
  actionVerb?: string;
  open: boolean;
  onOpenChange: (value: boolean) => void;
  onReauthFormSubmit: (values?: TRecipientActionAuth) => Promise<void> | void;
};

const Z2FAAuthFormSchema = z.object({
  token: z
    .string()
    .min(4, { message: 'Token must at least 4 characters long' })
    .max(10, { message: 'Token must be at most 10 characters long' }),
});

type T2FAAuthFormSchema = z.infer<typeof Z2FAAuthFormSchema>;

export const DocumentSigningAuth2FA = ({
  actionTarget = 'FIELD',
  actionVerb = 'sign',
  onReauthFormSubmit,
  open,
  onOpenChange,
}: DocumentSigningAuth2FAProps) => {
  const { recipient, user, isCurrentlyAuthenticating, setIsCurrentlyAuthenticating } =
    useRequiredDocumentSigningAuthContext();
  const { toast } = useToast();

  const form = useForm<T2FAAuthFormSchema>({
    resolver: zodResolver(Z2FAAuthFormSchema),
    defaultValues: {
      token: '',
    },
  });

  const [is2FASetupSuccessful, setIs2FASetupSuccessful] = useState(false);
  const [isEmailCodeSent, setIsEmailCodeSent] = useState(false);
  const [isEmailCodeSending, setIsEmailCodeSending] = useState(false);
  const [formErrorCode, setFormErrorCode] = useState<string | null>(null);
  const [verificationMethod, setVerificationMethod] = useState<'app' | 'email'>(
    user?.twoFactorEnabled ? 'app' : 'email',
  );

  const sendVerificationMutation = trpc.auth.sendEmailVerification.useMutation({
    onSuccess: () => {
      setIsEmailCodeSent(true);
      toast({
        title: 'Verification code sent',
        description: `A verification code has been sent to ${recipient.email}`,
      });
    },
    onError: (error) => {
      console.error('Failed to send verification code', error);
      toast({
        title: 'Failed to send verification code',
        description: 'Please try again or contact support',
        variant: 'destructive',
      });
    },
    onSettled: () => {
      setIsEmailCodeSending(false);
    },
  });

  const verifyCodeMutation = trpc.auth.verifyEmailCode.useMutation();

  const sendEmailVerificationCode = async () => {
    try {
      setIsEmailCodeSending(true);
      await sendVerificationMutation.mutateAsync({
        recipientId: recipient.id,
      });
    } catch (error) {
      // Error is handled in the mutation callbacks
    }
  };

  const onFormSubmit = async ({ token }: T2FAAuthFormSchema) => {
    try {
      setIsCurrentlyAuthenticating(true);

      if (verificationMethod === 'email') {
        // Verify the email code first
        await verifyCodeMutation.mutateAsync({
          code: token,
          recipientId: recipient.id,
        });
      }

      await onReauthFormSubmit({
        type: DocumentAuth.TWO_FACTOR_AUTH,
        token,
      });

      setIsCurrentlyAuthenticating(false);
      onOpenChange(false);
    } catch (err) {
      setIsCurrentlyAuthenticating(false);

      const error = AppError.parseError(err);
      setFormErrorCode(error.code);
    }
  };

  useEffect(() => {
    form.reset({
      token: '',
    });

    setIs2FASetupSuccessful(false);
    setFormErrorCode(null);
    setIsEmailCodeSent(false);

    if (open && !user?.twoFactorEnabled) {
      setVerificationMethod('email');
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user?.twoFactorEnabled]);

  useEffect(() => {
    if (open && verificationMethod === 'email' && !isEmailCodeSent && !isEmailCodeSending) {
      void sendEmailVerificationCode();
    }
  }, [open, verificationMethod, isEmailCodeSent, isEmailCodeSending]);

  if (verificationMethod === 'app' && !user?.twoFactorEnabled && !is2FASetupSuccessful) {
    return (
      <div className="space-y-4">
        <Tabs
          value={verificationMethod}
          onValueChange={(val) => setVerificationMethod(val as 'app' | 'email')}
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="app">Authenticator App</TabsTrigger>
            <TabsTrigger value="email">Email Verification</TabsTrigger>
          </TabsList>
        </Tabs>

        <Alert variant="warning">
          <AlertDescription>
            <p>
              {recipient.role === RecipientRole.VIEWER && actionTarget === 'DOCUMENT' ? (
                <Trans>You need to setup 2FA to mark this document as viewed.</Trans>
              ) : (
                `You need to setup 2FA to ${actionVerb.toLowerCase()} this ${actionTarget.toLowerCase()}.`
              )}
            </p>

            <p className="mt-2">
              <Trans>
                By enabling 2FA, you will be required to enter a code from your authenticator app
                every time you sign in using email password.
              </Trans>
            </p>
          </AlertDescription>
        </Alert>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            <Trans>Close</Trans>
          </Button>

          <EnableAuthenticatorAppDialog onSuccess={() => setIs2FASetupSuccessful(true)} />
        </DialogFooter>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {user?.twoFactorEnabled && (
        <Tabs
          value={verificationMethod}
          onValueChange={(val) => setVerificationMethod(val as 'app' | 'email')}
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="app">Authenticator App</TabsTrigger>
            <TabsTrigger value="email">Email Verification</TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      {verificationMethod === 'email' && (
        <Alert variant="secondary">
          <AlertDescription>
            {isEmailCodeSent ? (
              <p>
                <Trans>
                  A verification code has been sent to {recipient.email}. Please enter it below to
                  continue.
                </Trans>
              </p>
            ) : (
              <p>
                <Trans>
                  We'll send a verification code to {recipient.email} to verify your identity.
                </Trans>
              </p>
            )}
          </AlertDescription>
        </Alert>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onFormSubmit)}>
          <fieldset disabled={isCurrentlyAuthenticating}>
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="token"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>
                      {verificationMethod === 'app' ? (
                        <Trans>2FA token</Trans>
                      ) : (
                        <Trans>Verification code</Trans>
                      )}
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

              {verificationMethod === 'email' && (
                <div className="flex justify-center">
                  <Button
                    type="button"
                    variant="link"
                    disabled={isEmailCodeSending}
                    onClick={() => void sendEmailVerificationCode()}
                  >
                    {isEmailCodeSending ? <Trans>Sending...</Trans> : <Trans>Resend code</Trans>}
                  </Button>
                </div>
              )}

              {formErrorCode && (
                <Alert variant="destructive">
                  <AlertTitle>
                    <Trans>Unauthorized</Trans>
                  </AlertTitle>
                  <AlertDescription>
                    <Trans>
                      We were unable to verify your details. Please try again or contact support
                    </Trans>
                  </AlertDescription>
                </Alert>
              )}

              <DialogFooter>
                <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
                  <Trans>Cancel</Trans>
                </Button>

                <Button type="submit" loading={isCurrentlyAuthenticating}>
                  <Trans>{actionTarget === 'DOCUMENT' ? 'Sign Document' : 'Sign Field'}</Trans>
                </Button>
              </DialogFooter>
            </div>
          </fieldset>
        </form>
      </Form>
    </div>
  );
};
