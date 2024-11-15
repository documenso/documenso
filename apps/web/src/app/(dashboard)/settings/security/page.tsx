import type { Metadata } from 'next';
import Link from 'next/link';

import { Trans, msg } from '@lingui/macro';
import { useLingui } from '@lingui/react';

import { setupI18nSSR } from '@documenso/lib/client-only/providers/i18n.server';
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
  await setupI18nSSR();

  const { _ } = useLingui();
  const { user } = await getRequiredServerComponentSession();

  const isPasskeyEnabled = await getServerComponentFlag('app_passkey');

  return (
    <div>
      <SettingsHeader
        title={_(msg`Security`)}
        subtitle={_(msg`Here you can manage your password and security settings.`)}
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
          <AlertTitle>
            <Trans>Two factor authentication</Trans>
          </AlertTitle>

          <AlertDescription className="mr-4">
            {user.identityProvider === 'DOCUMENSO' ? (
              <Trans>
                Add an authenticator to serve as a secondary authentication method when signing in,
                or when signing documents.
              </Trans>
            ) : (
              <Trans>
                Add an authenticator to serve as a secondary authentication method for signing
                documents.
              </Trans>
            )}
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
            <AlertTitle>
              <Trans>Recovery codes</Trans>
            </AlertTitle>

            <AlertDescription className="mr-4">
              <Trans>
                Two factor authentication recovery codes are used to access your account in the
                event that you lose access to your authenticator app.
              </Trans>
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
            <AlertTitle>
              <Trans>Passkeys</Trans>
            </AlertTitle>

            <AlertDescription className="mr-4">
              <Trans>
                Allows authenticating using biometrics, password managers, hardware keys, etc.
              </Trans>
            </AlertDescription>
          </div>

          <Button asChild variant="outline" className="bg-background">
            <Link href="/settings/security/passkeys">
              <Trans>Manage passkeys</Trans>
            </Link>
          </Button>
        </Alert>
      )}

      <Alert
        className="mt-6 flex flex-col justify-between p-6 sm:flex-row sm:items-center"
        variant="neutral"
      >
        <div className="mb-4 mr-4 sm:mb-0">
          <AlertTitle>
            <Trans>Recent activity</Trans>
          </AlertTitle>

          <AlertDescription className="mr-2">
            <Trans>View all recent security activity related to your account.</Trans>
          </AlertDescription>
        </div>

        <Button asChild variant="outline" className="bg-background">
          <Link href="/settings/security/activity">
            <Trans>View activity</Trans>
          </Link>
        </Button>
      </Alert>
    </div>
  );
}
