import type { Metadata } from 'next';
import Link from 'next/link';

import { IDENTITY_PROVIDER_NAME } from '@documenso/lib/constants/auth';
import { getRequiredServerComponentSession } from '@documenso/lib/next-auth/get-server-component-session';
import type { PageParams } from '@documenso/lib/types/page-params';
import { Alert, AlertDescription, AlertTitle } from '@documenso/ui/primitives/alert';
import { Button } from '@documenso/ui/primitives/button';

import initTranslations from '~/app/i18n';
import { AuthenticatorApp } from '~/components/forms/2fa/authenticator-app';
import { RecoveryCodes } from '~/components/forms/2fa/recovery-codes';
import { PasswordForm } from '~/components/forms/password';

export const metadata: Metadata = {
  title: 'Security',
};

export default async function SecuritySettingsPage({ params: { locale } }: PageParams) {
  const { t } = await initTranslations(locale);
  const { user } = await getRequiredServerComponentSession();

  return (
    <div>
      <h3 className="text-2xl font-semibold">{t('security')}</h3>

      <p className="text-muted-foreground mt-2 text-sm">
        {t('manage_your_password_security_settings')}
      </p>

      <hr className="my-4" />

      {user.identityProvider === 'DOCUMENSO' ? (
        <div>
          <PasswordForm user={user} />

          <hr className="border-border/50 mt-6" />

          <Alert
            className="mt-6 flex flex-col justify-between p-6 sm:flex-row sm:items-center"
            variant="neutral"
          >
            <div className="mb-4 sm:mb-0">
              <AlertTitle>{t('two_factor_authentication')}</AlertTitle>

              <AlertDescription className="mr-4">{t('create_one_time_password')}</AlertDescription>
            </div>

            <AuthenticatorApp isTwoFactorEnabled={user.twoFactorEnabled} />
          </Alert>

          {user.twoFactorEnabled && (
            <Alert
              className="mt-6 flex flex-col justify-between p-6 sm:flex-row sm:items-center"
              variant="neutral"
            >
              <div className="mb-4 sm:mb-0">
                <AlertTitle>{t('recovery_codes')}</AlertTitle>

                <AlertDescription className="mr-4">
                  {t('access_to_your_authenticator_app')}
                </AlertDescription>
              </div>

              <RecoveryCodes isTwoFactorEnabled={user.twoFactorEnabled} />
            </Alert>
          )}
        </div>
      ) : (
        <Alert className="p-6" variant="neutral">
          <AlertTitle>
            {t('your_account_is_managed_by', {
              identity_provider_name: IDENTITY_PROVIDER_NAME[user.identityProvider],
            })}
          </AlertTitle>

          <AlertDescription>
            {t('please_go_to_your_identityprovider_settings', {
              identity_provider_name: IDENTITY_PROVIDER_NAME[user.identityProvider],
            })}
          </AlertDescription>
        </Alert>
      )}

      <Alert
        className="mt-6 flex flex-col justify-between p-6 sm:flex-row sm:items-center"
        variant="neutral"
      >
        <div className="mb-4 mr-4 sm:mb-0">
          <AlertTitle>{t('recent_activity')}</AlertTitle>

          <AlertDescription className="mr-2">
            {t('view_all_recent_security_activity')}
          </AlertDescription>
        </div>

        <Button asChild>
          <Link href="/settings/security/activity">{t('view_activity')}</Link>
        </Button>
      </Alert>
    </div>
  );
}
