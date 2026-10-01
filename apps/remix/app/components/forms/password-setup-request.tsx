import { usePasswordSetupRequest } from '@documenso/lib/client-only/hooks/use-password-setup-request';
import { useSession } from '@documenso/lib/client-only/providers/session';
import { Alert, AlertDescription, AlertTitle } from '@documenso/ui/primitives/alert';
import { Button } from '@documenso/ui/primitives/button';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { match } from 'ts-pattern';

export type PasswordSetupRequestProps = {
  className?: string;
};

/**
 * Inline "send me a setup link" control with its own sent/error states, for
 * contexts like dialogs where a toast would be missed.
 */
export const PasswordSetupRequest = ({ className }: PasswordSetupRequestProps) => {
  const { _ } = useLingui();
  const { user } = useSession();

  const { requestSetupLink, isPending, isSuccess, errorCode } = usePasswordSetupRequest();

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
      {errorCode && (
        <Alert className="mb-4" variant="destructive">
          <AlertTitle>
            <Trans>An error occurred</Trans>
          </AlertTitle>
          <AlertDescription>
            {match(errorCode)
              .with('SIGNIN_DISABLED', () =>
                _(msg`Password sign in is disabled for this instance. Please contact support.`),
              )
              .otherwise(() => _(msg`We were unable to send the email. Please try again or contact support.`))}
          </AlertDescription>
        </Alert>
      )}

      <Button type="button" loading={isPending} onClick={requestSetupLink}>
        <Trans>Send setup link</Trans>
      </Button>
    </div>
  );
};
