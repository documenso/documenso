import type { Metadata } from 'next';
import Link from 'next/link';

import { getRequiredServerComponentSession } from '@documenso/lib/next-auth/get-server-component-session';
import { getServerComponentFlag } from '@documenso/lib/server-only/feature-flags/get-server-component-feature-flag';
import { Alert, AlertDescription, AlertTitle } from '@documenso/ui/primitives/alert';
import { Button } from '@documenso/ui/primitives/button';

import { SettingsHeader } from '~/components/(dashboard)/settings/layout/header';
import { DisableAuthenticatorAppDialog } from '~/components/forms/2fa/disable-authenticator-app-dialog';
import { EnableAuthenticatorAppDialog } from '~/components/forms/2fa/enable-authenticator-app-dialog';
import { ViewRecoveryCodesDialog } from '~/components/forms/2fa/view-recovery-codes-dialog';
import { PasswordForm } from '~/components/forms/password';

export const metadata: Metadata = {
  title: 'Security',
};

export default async function SecuritySettingsPage() {
  const { user } = await getRequiredServerComponentSession();

  const isPasskeyEnabled = await getServerComponentFlag('app_passkey');

  return (
    <div>
      <SettingsHeader
        title="Security"
        subtitle="Here you can manage your password and security settings."
      />

      {user.identityProvider === 'DOCUMENSO' && (
        <>
          <PasswordForm user={user} />

          <hr className="border-border/50 mt-6" />
        </>
      )}

      <Alert
        className="mt-6 flex flex-col justify-between p-6 sm:flex-row sm:items-center"
        variant="neutral"
      >
        <div className="mb-4 sm:mb-0">
          <AlertTitle>Two factor authentication</AlertTitle>

          <AlertDescription className="mr-4">
            Add an authenticator to serve as a secondary authentication method{' '}
            {user.identityProvider === 'DOCUMENSO'
              ? 'when signing in, or when signing documents.'
              : 'for signing documents.'}
          </AlertDescription>
        </div>

        {user.twoFactorEnabled ? (
          <DisableAuthenticatorAppDialog />
        ) : (
          <EnableAuthenticatorAppDialog />
        )}
      </Alert>

      {user.twoFactorEnabled && (
        <Alert
          className="mt-6 flex flex-col justify-between p-6 sm:flex-row sm:items-center"
          variant="neutral"
        >
          <div className="mb-4 sm:mb-0">
            <AlertTitle>Recovery codes</AlertTitle>

            <AlertDescription className="mr-4">
              Two factor authentication recovery codes are used to access your account in the event
              that you lose access to your authenticator app.
            </AlertDescription>
          </div>

          <ViewRecoveryCodesDialog />
        </Alert>
      )}

      {isPasskeyEnabled && (
        <Alert
          className="mt-6 flex flex-col justify-between p-6 sm:flex-row sm:items-center"
          variant="neutral"
        >
          <div className="mb-4 sm:mb-0">
            <AlertTitle>Passkeys</AlertTitle>

            <AlertDescription className="mr-4">
              Allows authenticating using biometrics, password managers, hardware keys, etc.
            </AlertDescription>
          </div>

          <Button asChild variant="outline" className="bg-background">
            <Link href="/settings/security/passkeys">Manage passkeys</Link>
          </Button>
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

        <Button asChild variant="outline" className="bg-background">
          <Link href="/settings/security/activity">View activity</Link>
        </Button>
      </Alert>
    </div>
  );
}
