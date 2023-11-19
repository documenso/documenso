import { redirect } from 'next/navigation';

import { DOCUMENSO_ENCRYPTION_KEY } from '@documenso/lib/constants/crypto';
import { getRequiredServerComponentSession } from '@documenso/lib/next-auth/get-server-component-session';

import { TwoFactorAuthenticationForm } from '~/components/forms/2fa/two-factor-authentication';

export default async function TwoFactorAuthPage() {
  const { user } = await getRequiredServerComponentSession();

  const isTwoFactorAuthEnabled =
    user.identityProvider === 'DOCUMENSO' && typeof DOCUMENSO_ENCRYPTION_KEY === 'string';

  if (!isTwoFactorAuthEnabled) {
    redirect('/settings/profile');
  }
  return (
    <div>
      <h3 className="text-lg font-medium">Two-Factor Authentication</h3>

      <p className="text-muted-foreground mt-2 text-sm">
        Two-factor authentication enhances your account's security by requiring additional
        credentials beyond just a password for access.
      </p>

      <hr className="my-4" />

      <TwoFactorAuthenticationForm />
    </div>
  );
}
