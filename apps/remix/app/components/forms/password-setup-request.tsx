import { authClient } from '@documenso/auth/client';
import { useSession } from '@documenso/lib/client-only/providers/session';
import { AppError } from '@documenso/lib/errors/app-error';
import { Alert, AlertDescription, AlertTitle } from '@documenso/ui/primitives/alert';
import { Button } from '@documenso/ui/primitives/button';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { useMutation } from '@tanstack/react-query';
import { match } from 'ts-pattern';

export type PasswordSetupRequestProps = {
  className?: string;
};

/**
 * For signed in users who do not have a password. Sends them the standard
 * password reset email so they can set one via a verified link, rather than
 * allowing a bare session to mint a credential.
 */
export const PasswordSetupRequest = ({ className }: PasswordSetupRequestProps) => {
  const { _ } = useLingui();
  const { user } = useSession();

  const {
    mutate: requestSetupLink,
    isPending,
    isSuccess,
    error,
  } = useMutation({
    mutationFn: async () => authClient.emailPassword.forgotPassword({ email: user.email }),
  });

  if (isSuccess) {
    return (
      <Alert className={className} variant="neutral">
        <AlertTitle>
          <Trans>Check your email</Trans>
        </AlertTitle>
        <AlertDescription>
          <Trans>
            We've sent a link to {user.email}. Follow it to set your password, then sign in again to continue.
          </Trans>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className={className}>
      {error && (
        <Alert className="mb-4" variant="destructive">
          <AlertTitle>
            <Trans>An error occurred</Trans>
          </AlertTitle>
          <AlertDescription>
            {match(AppError.parseError(error).code)
              .with('SIGNIN_DISABLED', () =>
                _(msg`Password sign in is disabled for this instance. Please contact support.`),
              )
              .otherwise(() => _(msg`We were unable to send the email. Please try again or contact support.`))}
          </AlertDescription>
        </Alert>
      )}

      <Button type="button" loading={isPending} onClick={() => requestSetupLink()}>
        <Trans>Email me a link to set a password</Trans>
      </Button>
    </div>
  );
};
