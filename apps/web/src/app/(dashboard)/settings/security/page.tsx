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
        title="უსაფრთხოება"
        subtitle="აქ შეგიძლიათ მართოთ თქვენი პაროლი და უსაფრთხოების პარამეტრები."
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
          <AlertTitle>ორ ფაქტორიანი ავთენტიფიკაცია (2FA)</AlertTitle>

          <AlertDescription className="mr-4">
            დაამატეთ ავთენტიფიკატორი მეორე ავტორიზაციის მეთოდად{' '}
            {user.identityProvider === 'DOCUMENSO'
              ? 'შესვლისას, ან დოკუმენტების ხელმოწერისას.'
              : 'დოკუმენტების ხელმოწერისას.'}
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
            <AlertTitle>აღდგენის კოდები</AlertTitle>

            <AlertDescription className="mr-4">
              ორ ფაქტორიანი (2FA) ავთენტიფიკაციის აღდგენის კოდები გამოიყენება თქვენს ანგარიშზე
              წვდომისთვის იმ შემთხვევაში, თუ დაკარგავთ წვდომას ავთენტიფიკატორ აპლიკაციაზე.
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
          <AlertTitle>ბოლო აქტივობა</AlertTitle>

          <AlertDescription className="mr-2">
            თქვენს ანგარიშთან დაკავშირებული უსაფრთხოების ყველა ბოლო აქტივობის ნახვა.
          </AlertDescription>
        </div>

        <Button asChild variant="outline" className="bg-background">
          <Link href="/settings/security/activity">აქტივობის ნახვა</Link>
        </Button>
      </Alert>
    </div>
  );
}
