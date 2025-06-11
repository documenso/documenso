import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { Link } from 'react-router';

import { getSession } from '@documenso/auth/server/lib/utils/get-session';
import { useSession } from '@documenso/lib/client-only/providers/session';
import { prisma } from '@documenso/prisma';
import { Alert, AlertDescription, AlertTitle } from '@documenso/ui/primitives/alert';
import { Button } from '@documenso/ui/primitives/button';

import { DisableAuthenticatorAppDialog } from '~/components/forms/2fa/disable-authenticator-app-dialog';
import { EnableAuthenticatorAppDialog } from '~/components/forms/2fa/enable-authenticator-app-dialog';
import { ViewRecoveryCodesDialog } from '~/components/forms/2fa/view-recovery-codes-dialog';
import { PasswordForm } from '~/components/forms/password';
import { SettingsHeader } from '~/components/general/settings-header';
import { appMetaTags } from '~/utils/meta';

import type { Route } from './+types/security._index';

export function meta() {
  return appMetaTags('Security');
}

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await getSession(request);

  // Todo: Use providers instead after RR7 migration.
  // const accounts = await prisma.account.findMany({
  //   where: {
  //     userId: user.id,
  //   },
  //   select: {
  //     provider: true,
  //   },
  // });

  // const providers = accounts.map((account) => account.provider);
  // let hasEmailPasswordAccount = providers.includes('DOCUMENSO');

  const hasEmailPasswordAccount: boolean = await prisma.user
    .count({
      where: {
        id: user.id,
        password: {
          not: null,
        },
      },
    })
    .then((value) => value > 0);

  return {
    // providers,
    hasEmailPasswordAccount,
  };
}

export default function SettingsSecurity({ loaderData }: Route.ComponentProps) {
  const { hasEmailPasswordAccount } = loaderData;

  const { _ } = useLingui();
  const { user } = useSession();

  return (
    <div>
      <SettingsHeader
        title={_(msg`Security`)}
        subtitle={_(msg`Here you can manage your password and security settings.`)}
      />
      {hasEmailPasswordAccount && (
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
            {hasEmailPasswordAccount ? (
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
          <Link to="/settings/security/passkeys">
            <Trans>Manage passkeys</Trans>
          </Link>
        </Button>
      </Alert>

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
          <Link to="/settings/security/activity">
            <Trans>View activity</Trans>
          </Link>
        </Button>
      </Alert>

      <Alert
        className="mt-6 flex flex-col justify-between p-6 sm:flex-row sm:items-center"
        variant="neutral"
      >
        <div className="mb-4 mr-4 sm:mb-0">
          <AlertTitle>
            <Trans>Active sessions</Trans>
          </AlertTitle>

          <AlertDescription className="mr-2">
            <Trans>View and manage all active sessions for your account.</Trans>
          </AlertDescription>
        </div>

        <Button asChild variant="outline" className="bg-background">
          <Link to="/settings/security/sessions">
            <Trans>Manage sessions</Trans>
          </Link>
        </Button>
      </Alert>
    </div>
  );
}
