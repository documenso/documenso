import { IDENTITY_PROVIDER_NAME } from '@documenso/lib/constants/auth';
import { getRequiredServerComponentSession } from '@documenso/lib/next-auth/get-server-component-session';

import { AuthenticatorApp } from '~/components/forms/2fa/authenticator-app';
import { RecoveryCodes } from '~/components/forms/2fa/recovery-codes';
import { PasswordForm } from '~/components/forms/password';

export default async function SecuritySettingsPage() {
  const { user } = await getRequiredServerComponentSession();

  return (
    <div>
      <h3 className="text-2xl font-semibold">Security</h3>

      <p className="text-muted-foreground mt-2 text-sm">
        Here you can manage your password and security settings.
      </p>

      <hr className="my-4" />

      {user.identityProvider === 'DOCUMENSO' ? (
        <div>
          <PasswordForm user={user} className="max-w-xl" />

          <hr className="mb-4 mt-8" />

          <h4 className="text-lg font-medium">Two Factor Authentication</h4>

          <p className="text-muted-foreground mt-2 text-sm">
            Add and manage your two factor security settings to add an extra layer of security to
            your account!
          </p>

          <div className="mt-4 max-w-xl">
            <h5 className="font-medium">Two-factor methods</h5>

            <AuthenticatorApp isTwoFactorEnabled={user.twoFactorEnabled} />
          </div>

          {user.twoFactorEnabled && (
            <div className="mt-4 max-w-xl">
              <h5 className="font-medium">Recovery methods</h5>

              <RecoveryCodes isTwoFactorEnabled={user.twoFactorEnabled} />
            </div>
          )}
        </div>
      ) : (
        <div>
          <h4 className="text-lg font-medium">
            Your account is managed by {IDENTITY_PROVIDER_NAME[user.identityProvider]}
          </h4>
          <p className="text-muted-foreground mt-2 text-sm">
            To update your password, enable two-factor authentication, and manage other security
            settings, please go to your {IDENTITY_PROVIDER_NAME[user.identityProvider]} account
            settings.
          </p>
        </div>
      )}
    </div>
  );
}
