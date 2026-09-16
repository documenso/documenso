import { authClient } from '@documenso/auth/client';
import { AuthenticationErrorCode } from '@documenso/auth/server/lib/errors/error-codes';
import { getOptionalSession } from '@documenso/auth/server/lib/utils/get-session';
import { AppError } from '@documenso/lib/errors/app-error';
import { Button } from '@documenso/ui/primitives/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@documenso/ui/primitives/form/form';
import { Input } from '@documenso/ui/primitives/input';
import { PinInput, PinInputGroup, PinInputSlot } from '@documenso/ui/primitives/pin-input';
import { useToast } from '@documenso/ui/primitives/use-toast';
import { zodResolver } from '@hookform/resolvers/zod';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { Loader2Icon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, redirect, useNavigate } from 'react-router';
import { z } from 'zod';

import { appMetaTags } from '~/utils/meta';

import type { Route } from './+types/2fa-challenge';

export function meta() {
  return appMetaTags(msg`Two-Factor Authentication`);
}

export async function loader({ request }: Route.LoaderArgs) {
  const { isAuthenticated } = await getOptionalSession(request);

  // A signed-in user has no pending challenge to complete (any successful
  // sign-in clears it server-side).
  if (isAuthenticated) {
    throw redirect('/');
  }

  return null;
}

const ZTwoFactorChallengeFormSchema = z.object({
  totpCode: z.string().trim().optional(),
  backupCode: z.string().trim().optional(),
});

type TTwoFactorChallengeFormSchema = z.infer<typeof ZTwoFactorChallengeFormSchema>;

export default function TwoFactorChallenge() {
  const { _ } = useLingui();
  const { toast } = useToast();

  const navigate = useNavigate();

  const [isValidatingChallenge, setIsValidatingChallenge] = useState(true);
  const [twoFactorAuthenticationMethod, setTwoFactorAuthenticationMethod] = useState<'totp' | 'backup'>('totp');

  const form = useForm<TTwoFactorChallengeFormSchema>({
    values: {
      totpCode: '',
      backupCode: '',
    },
    resolver: zodResolver(ZTwoFactorChallengeFormSchema),
  });

  const isSubmitting = form.formState.isSubmitting;

  const onRedirectToSignIn = async () => {
    toast({
      title: _(msg`Sign in required`),
      description: _(msg`Your sign-in attempt has expired. Please sign in again.`),
      variant: 'destructive',
    });

    await navigate('/signin');
  };

  useEffect(() => {
    void authClient.twoFactor
      .getChallenge()
      .then(async ({ valid }) => {
        if (!valid) {
          await onRedirectToSignIn();

          return;
        }

        setIsValidatingChallenge(false);
      })
      .catch(async () => onRedirectToSignIn());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onToggleTwoFactorAuthenticationMethodClick = () => {
    const method = twoFactorAuthenticationMethod === 'totp' ? 'backup' : 'totp';

    if (method === 'totp') {
      form.setValue('backupCode', '');
    }

    if (method === 'backup') {
      form.setValue('totpCode', '');
    }

    setTwoFactorAuthenticationMethod(method);
  };

  const onFormSubmit = async ({ totpCode, backupCode }: TTwoFactorChallengeFormSchema) => {
    try {
      // On success this navigates to the server-provided redirect path.
      await authClient.twoFactor.verifyChallenge(
        twoFactorAuthenticationMethod === 'totp' ? { totpCode } : { backupCode },
      );
    } catch (err) {
      const error = AppError.parseError(err);

      if (error.code === AuthenticationErrorCode.TwoFactorChallengeExpired) {
        await onRedirectToSignIn();

        return;
      }

      if (error.code === AuthenticationErrorCode.InvalidTwoFactorCode) {
        toast({
          title: _(msg`Unable to sign in`),
          description: _(msg`The two-factor authentication code provided is incorrect.`),
          variant: 'destructive',
        });

        return;
      }

      toast({
        title: _(msg`Something went wrong`),
        description: _(msg`We were unable to verify your code. Please try again.`),
        variant: 'destructive',
      });
    }
  };

  if (isValidatingChallenge) {
    return (
      <div className="w-screen max-w-lg px-4">
        <div className="flex flex-col items-center justify-center gap-y-4 py-12">
          <Loader2Icon className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-muted-foreground text-sm">
            <Trans>Checking your sign-in...</Trans>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-screen max-w-lg px-4">
      <div className="z-10 rounded-xl border border-border bg-neutral-100 p-6 dark:bg-background">
        <h1 className="font-semibold text-2xl">
          <Trans>Two-Factor Authentication</Trans>
        </h1>

        <p className="mt-2 text-muted-foreground text-sm">
          {twoFactorAuthenticationMethod === 'totp' ? (
            <Trans>Enter the code from your authenticator app to finish signing in.</Trans>
          ) : (
            <Trans>Enter one of your backup codes to finish signing in.</Trans>
          )}
        </p>

        <hr className="-mx-6 my-4" />

        <Form {...form}>
          <form className="flex w-full flex-col gap-y-4" onSubmit={form.handleSubmit(onFormSubmit)}>
            <fieldset className="flex w-full flex-col gap-y-4" disabled={isSubmitting}>
              {twoFactorAuthenticationMethod === 'totp' && (
                <FormField
                  control={form.control}
                  name="totpCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        <Trans>Token</Trans>
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
              )}

              {twoFactorAuthenticationMethod === 'backup' && (
                <FormField
                  control={form.control}
                  name="backupCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        <Trans>Backup Code</Trans>
                      </FormLabel>
                      <FormControl>
                        <Input type="text" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <div className="flex flex-col gap-y-2 sm:flex-row sm:justify-end sm:gap-x-2">
                <Button type="button" variant="secondary" onClick={onToggleTwoFactorAuthenticationMethodClick}>
                  {twoFactorAuthenticationMethod === 'totp' ? (
                    <Trans>Use Backup Code</Trans>
                  ) : (
                    <Trans>Use Authenticator</Trans>
                  )}
                </Button>

                <Button type="submit" loading={isSubmitting}>
                  {isSubmitting ? <Trans>Signing in...</Trans> : <Trans>Sign In</Trans>}
                </Button>
              </div>
            </fieldset>
          </form>
        </Form>

        <p className="mt-6 text-center text-muted-foreground text-sm">
          <Trans>
            Not you?{' '}
            <Link to="/signin" className="text-documenso-700 duration-200 hover:opacity-70">
              Back to sign in
            </Link>
          </Trans>
        </p>
      </div>
    </div>
  );
}
