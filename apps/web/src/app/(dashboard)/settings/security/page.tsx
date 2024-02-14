import type { Metadata } from 'next';
import Link from 'next/link';

import { IDENTITY_PROVIDER_NAME } from '@documenso/lib/constants/auth';
import { getRequiredServerComponentSession } from '@documenso/lib/next-auth/get-server-component-session';
import { Alert, AlertDescription, AlertTitle } from '@documenso/ui/primitives/alert';
import { Button } from '@documenso/ui/primitives/button';

import { SettingsHeader } from '~/components/(dashboard)/settings/layout/header';
import { AuthenticatorApp } from '~/components/forms/2fa/authenticator-app';
import { RecoveryCodes } from '~/components/forms/2fa/recovery-codes';
import { PasswordForm } from '~/components/forms/password';

export const metadata: Metadata = {
  title: 'Security',
};

export default async function SecuritySettingsPage() {
  const { user } = await getRequiredServerComponentSession();

  return (
    <div>
      <SettingsHeader
        title="Security"
        subtitle="Here you can manage your password and security settings."
      />

      {user.identityProvider === 'DOCUMENSO' ? (
        <div>
          <PasswordForm user={user} />

          <hr className="border-border/50 mt-6" />

          <Alert
            className="mt-6 flex flex-col justify-between p-6 sm:flex-row sm:items-center"
            variant="neutral"
          >
            <div className="mb-4 sm:mb-0">
              <AlertTitle>Two factor authentication</AlertTitle>

              <AlertDescription className="mr-4">
                Create one-time passwords that serve as a secondary authentication method for
                confirming your identity when requested during the sign-in process.
              </AlertDescription>
            </div>

            <AuthenticatorApp isTwoFactorEnabled={user.twoFactorEnabled} />
          </Alert>

          {user.twoFactorEnabled && (
            <Alert
              className="mt-6 flex flex-col justify-between p-6 sm:flex-row sm:items-center"
              variant="neutral"
            >
              <div className="mb-4 sm:mb-0">
                <AlertTitle>Recovery codes</AlertTitle>

                <AlertDescription className="mr-4">
                  Two factor authentication recovery codes are used to access your account in the
                  event that you lose access to your authenticator app.
                </AlertDescription>
              </div>

              <RecoveryCodes isTwoFactorEnabled={user.twoFactorEnabled} />
            </Alert>
          )}
        </div>
      ) : (
        <Alert className="p-6" variant="neutral">
          <AlertTitle>
            Your account is managed by {IDENTITY_PROVIDER_NAME[user.identityProvider]}
          </AlertTitle>

          <AlertDescription>
            To update your password, enable two-factor authentication, and manage other security
            settings, please go to your {IDENTITY_PROVIDER_NAME[user.identityProvider]} account
            settings.
          </AlertDescription>
        </Alert>
      )}

      <Alert
        className="mt-6 flex flex-col justify-between p-6 sm:flex-row sm:items-center"
        variant="neutral"
      >
        <div className="mb-4 mr-4 sm:mb-0">
          <AlertTitle>Recent activity</AlertTitle>

          <AlertDescription className="mr-2">
            View all recent security activity related to your account.
          </AlertDescription>
        </div>

        <Button asChild>
          <Link href="/settings/security/activity">View activity</Link>
        </Button>
      </Alert>
    </div>
  );
}
