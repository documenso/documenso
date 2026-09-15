import { isSigninEnabledForProvider } from '@documenso/lib/constants/auth';
import { Alert, AlertDescription, AlertTitle } from '@documenso/ui/primitives/alert';
import { Button } from '@documenso/ui/primitives/button';
import { DialogFooter } from '@documenso/ui/primitives/dialog';
import { Trans } from '@lingui/react/macro';

import { PasswordSetupRequest } from '~/components/forms/password-setup-request';

export type DocumentSigningAuthSetPasswordProps = {
  onOpenChange: (value: boolean) => void;
};

/**
 * Shown in place of the password reauth form when the signed in user has no
 * password (e.g. they signed up via OAuth or a passkey).
 *
 * Password based action auth is meant to prove more than possession of a session,
 * so rather than letting the session set a password inline we send the user the
 * verified reset link and ask them to come back.
 */
export const DocumentSigningAuthSetPassword = ({ onOpenChange }: DocumentSigningAuthSetPasswordProps) => {
  const isEmailPasswordSigninEnabled = isSigninEnabledForProvider('email');

  return (
    <div className="space-y-4">
      {isEmailPasswordSigninEnabled ? (
        <>
          <Alert variant="neutral">
            <AlertTitle>
              <Trans>No password set</Trans>
            </AlertTitle>
            <AlertDescription>
              <Trans>
                Signing this field requires a password, but your account does not have one. We can email you a link to
                set one. Once done, sign in again and return to this document to continue.
              </Trans>
            </AlertDescription>
          </Alert>

          <PasswordSetupRequest />
        </>
      ) : (
        <Alert variant="warning">
          <AlertTitle>
            <Trans>Password authentication unavailable</Trans>
          </AlertTitle>
          <AlertDescription>
            <Trans>
              Your account does not have a password and password sign in is disabled for this instance. Please contact
              the document sender to use a different authentication method.
            </Trans>
          </AlertDescription>
        </Alert>
      )}

      <DialogFooter>
        <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
          <Trans>Close</Trans>
        </Button>
      </DialogFooter>
    </div>
  );
};
