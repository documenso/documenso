import { authClient } from '@documenso/auth/client';
import { getOptionalSession } from '@documenso/auth/server/lib/utils/get-session';
import { downloadFile } from '@documenso/lib/client-only/download-file';
import { AppError } from '@documenso/lib/errors/app-error';
import { getTwoFactorEnforcementStatus } from '@documenso/lib/server-only/2fa/get-two-factor-enforcement-status';
import { isValidReturnTo, normalizeReturnTo } from '@documenso/lib/utils/is-valid-return-to';
import { isTwoFactorSatisfied } from '@documenso/lib/utils/two-factor';
import { Button } from '@documenso/ui/primitives/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@documenso/ui/primitives/form/form';
import { PinInput, PinInputGroup, PinInputSlot } from '@documenso/ui/primitives/pin-input';
import { useToast } from '@documenso/ui/primitives/use-toast';
import { zodResolver } from '@hookform/resolvers/zod';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { Loader2Icon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, redirect, useNavigate, useRevalidator } from 'react-router';
import { renderSVG } from 'uqr';
import { z } from 'zod';

import { RecoveryCodeList } from '~/components/forms/2fa/recovery-code-list';
import { appMetaTags } from '~/utils/meta';
import { superLoaderJson, useSuperLoaderData } from '~/utils/super-json-loader';

import type { Route } from './+types/2fa';

export function meta() {
  return appMetaTags(msg`Two-Factor Authentication`);
}

export async function loader({ request }: Route.LoaderArgs) {
  const session = await getOptionalSession(request);

  const url = new URL(request.url);

  const rawReturnTo = url.searchParams.get('returnTo') ?? undefined;
  const returnTo = (isValidReturnTo(rawReturnTo) && normalizeReturnTo(rawReturnTo)) || '/';

  if (!session.isAuthenticated) {
    throw redirect(`/signin?returnTo=${encodeURIComponent(`${url.pathname}${url.search}`)}`);
  }

  // Auto-redirect ONLY when enforcement is already satisfied on arrival.
  // Every other state (including "not required") renders the page — a user
  // landing here after a backup-code recovery gets an explicit skip link
  // instead of being bounced away.
  if (
    isTwoFactorSatisfied({
      userTwoFactorEnabled: session.user.twoFactorEnabled,
      sessionTwoFactorVerified: session.session.twoFactorVerified,
    })
  ) {
    throw redirect(returnTo);
  }

  const twoFactorEnforcement = await getTwoFactorEnforcementStatus({
    user: session.user,
    session: session.session,
  });

  return superLoaderJson({
    returnTo,
    isTwoFactorEnabled: session.user.twoFactorEnabled,
    isSessionTwoFactorVerified: session.session.twoFactorVerified,
    twoFactorEnforcement,
  });
}

const ZEnableTwoFactorFormSchema = z.object({
  token: z.string().min(6).max(6),
});

type TEnableTwoFactorFormSchema = z.infer<typeof ZEnableTwoFactorFormSchema>;

export default function OnboardingTwoFactorPage() {
  const { returnTo, isTwoFactorEnabled, isSessionTwoFactorVerified, twoFactorEnforcement } =
    useSuperLoaderData<typeof loader>();

  const { _, i18n } = useLingui();
  const { toast } = useToast();

  const navigate = useNavigate();
  const { revalidate } = useRevalidator();

  // The whole page renders from the loader snapshot + local state, never from
  // the live session context. The session provider refreshes in the
  // background (and `twoFactorEnabled` flips the moment 2FA is enabled), but
  // navigation is controlled exclusively by this page's state machine —
  // recovery codes are shown exactly once and must stay on screen until the
  // user explicitly acknowledges saving them.
  const [setupData, setSetupData] = useState<{ uri: string; secret: string } | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [hasSetupFailed, setHasSetupFailed] = useState(false);

  const hasRequestedSetupRef = useRef(false);

  const isBlocked = twoFactorEnforcement.required && twoFactorEnforcement.isBlocked;
  const canSkip = !isBlocked;

  // State (b): enrolled, but this session was created before 2FA was enabled
  // so it never passed a second factor. Setup would rightly refuse
  // (already enabled), so the only remediation is a fresh sign-in.
  const requiresRelogin = isTwoFactorEnabled && !isSessionTwoFactorVerified;

  const form = useForm<TEnableTwoFactorFormSchema>({
    defaultValues: {
      token: '',
    },
    resolver: zodResolver(ZEnableTwoFactorFormSchema),
  });

  const { isSubmitting: isEnabling } = form.formState;

  // Enrolment goes through the auth routes (`authClient.twoFactor.*`), NOT
  // tRPC: while the user is blocked by instance enforcement, session tRPC
  // procedures respond 403 — the remediation page must not depend on them.
  const setupTwoFactor = async () => {
    setHasSetupFailed(false);

    try {
      const data = await authClient.twoFactor.setup();

      setSetupData(data);
    } catch (err) {
      const error = AppError.parseError(err);

      // The user enrolled concurrently (e.g. in another tab). Re-run the
      // loader instead of dead-ending on a retry that would refuse forever:
      // it auto-redirects when this session became verified by the
      // concurrent enable, or renders the sign-out-and-re-login prompt.
      if (error.code === 'TWO_FACTOR_ALREADY_ENABLED') {
        await revalidate();

        return;
      }

      setHasSetupFailed(true);

      toast({
        title: _(msg`Unable to setup two-factor authentication`),
        description: _(msg`We were unable to setup two-factor authentication for your account. Please try again.`),
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    if (isTwoFactorEnabled || hasRequestedSetupRef.current) {
      return;
    }

    hasRequestedSetupRef.current = true;

    void setupTwoFactor();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onEnableSubmit = async ({ token }: TEnableTwoFactorFormSchema) => {
    try {
      const data = await authClient.twoFactor.enable({ code: token });

      // Phase one complete. Do NOT navigate — show the recovery codes and
      // wait for the explicit acknowledgement below.
      setRecoveryCodes(data.recoveryCodes);
    } catch (err) {
      const error = AppError.parseError(err);

      // Enabled concurrently (e.g. another tab) between setup and enable —
      // the recovery codes were shown there. Re-run the loader to land on
      // the correct state instead of claiming the code was wrong.
      if (error.code === 'TWO_FACTOR_ALREADY_ENABLED') {
        toast({
          title: _(msg`Two-factor authentication is already enabled`),
          description: _(msg`Two-factor authentication was already enabled for your account.`),
        });

        await revalidate();

        return;
      }

      toast({
        title: _(msg`Unable to setup two-factor authentication`),
        description: _(
          msg`We were unable to setup two-factor authentication for your account. Please ensure that you have entered your code correctly and try again.`,
        ),
        variant: 'destructive',
      });
    }
  };

  const onDownloadRecoveryCodes = () => {
    if (!recoveryCodes) {
      return;
    }

    const blob = new Blob([recoveryCodes.join('\n')], {
      type: 'text/plain',
    });

    downloadFile({
      filename: 'documenso-2FA-recovery-codes.txt',
      data: blob,
    });
  };

  // Phase two: only the explicit acknowledgement navigates away.
  const onRecoveryCodesAcknowledged = async () => {
    await navigate(returnTo);
  };

  const onSignOut = async () => {
    await authClient.signOut();
  };

  return (
    <div className="w-screen max-w-lg px-4">
      <div className="z-10 rounded-xl border border-border bg-neutral-100 p-6 dark:bg-background">
        <h1 className="font-semibold text-2xl">
          <Trans>Two-factor authentication</Trans>
        </h1>

        {twoFactorEnforcement.required && isBlocked && (
          <p className="mt-2 text-muted-foreground text-sm">
            <Trans>Two-factor authentication is required to continue using your account.</Trans>
          </p>
        )}

        {twoFactorEnforcement.required && !isBlocked && (
          <p className="mt-2 text-muted-foreground text-sm">
            <Trans>
              Two-factor authentication is required for your account from{' '}
              {i18n.date(twoFactorEnforcement.deadline, { dateStyle: 'long' })}.
            </Trans>
          </p>
        )}

        <hr className="-mx-6 my-4" />

        {requiresRelogin ? (
          <div className="flex flex-col gap-y-4">
            <p className="text-muted-foreground text-sm">
              <Trans>
                Two-factor authentication is enabled for your account, but this session has not been verified with a
                second factor. Sign out and log back in to verify this session.
              </Trans>
            </p>

            <Button className="w-full sm:w-auto sm:self-end" onClick={() => void onSignOut()}>
              <Trans>Sign out</Trans>
            </Button>
          </div>
        ) : recoveryCodes ? (
          <div className="flex flex-col gap-y-4">
            <div>
              <h2 className="font-medium text-lg">
                <Trans>Save your recovery codes</Trans>
              </h2>

              <p className="mt-1 text-muted-foreground text-sm">
                <Trans>
                  Your recovery codes are listed below. Please store them in a safe place — they will not be shown
                  again.
                </Trans>
              </p>
            </div>

            <RecoveryCodeList recoveryCodes={recoveryCodes} />

            <div className="flex flex-col gap-y-2 sm:flex-row sm:justify-end sm:gap-x-2">
              <Button variant="secondary" onClick={onDownloadRecoveryCodes}>
                <Trans>Download</Trans>
              </Button>

              <Button onClick={() => void onRecoveryCodesAcknowledged()}>
                <Trans>I have saved my recovery codes</Trans>
              </Button>
            </div>
          </div>
        ) : !setupData ? (
          <div className="flex flex-col items-center justify-center gap-y-4 py-12">
            {hasSetupFailed ? (
              <>
                <p className="text-muted-foreground text-sm">
                  <Trans>We were unable to prepare two-factor authentication.</Trans>
                </p>

                <Button variant="secondary" onClick={() => void setupTwoFactor()}>
                  <Trans>Try again</Trans>
                </Button>
              </>
            ) : (
              <>
                <Loader2Icon className="h-8 w-8 animate-spin text-muted-foreground" />

                <p className="text-muted-foreground text-sm">
                  <Trans>Preparing two-factor authentication...</Trans>
                </p>
              </>
            )}
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onEnableSubmit)}>
              <fieldset disabled={isEnabling} className="flex flex-col gap-y-4">
                <p className="text-muted-foreground text-sm">
                  <Trans>
                    To enable two-factor authentication, scan the following QR code using your authenticator app.
                  </Trans>
                </p>

                <div
                  className="flex h-36 justify-center"
                  dangerouslySetInnerHTML={{
                    __html: renderSVG(setupData.uri),
                  }}
                />

                <p className="text-muted-foreground text-sm">
                  <Trans>
                    If your authenticator app does not support QR codes, you can use the following code instead:
                  </Trans>
                </p>

                <p className="rounded-lg bg-muted/60 p-2 text-center font-mono text-muted-foreground tracking-widest">
                  {setupData.secret}
                </p>

                <FormField
                  name="token"
                  control={form.control}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-muted-foreground">
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

                <Button type="submit" loading={isEnabling} className="w-full sm:w-auto sm:self-end">
                  <Trans>Enable 2FA</Trans>
                </Button>
              </fieldset>
            </form>
          </Form>
        )}

        {(canSkip || !requiresRelogin) && (
          <p className="mt-6 flex flex-col items-center gap-y-1 text-center text-muted-foreground text-sm">
            {canSkip && !recoveryCodes && (
              <Link to={returnTo} className="text-documenso-700 duration-200 hover:opacity-70">
                <Trans>Skip for now</Trans>
              </Link>
            )}

            {!requiresRelogin && (
              <button
                type="button"
                className="text-documenso-700 duration-200 hover:opacity-70"
                onClick={() => void onSignOut()}
              >
                <Trans>Sign out</Trans>
              </button>
            )}
          </p>
        )}
      </div>
    </div>
  );
}
