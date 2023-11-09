import { redirect } from 'next/navigation';

import { getRequiredServerComponentSession } from '@documenso/lib/next-auth/get-server-session';

import { TwoFactorAuthenticationForm } from '~/components/forms/2fa/two-factor-authentication';

export default async function TwoFactorAuthPage() {
  const { user } = await getRequiredServerComponentSession();

  if (user.identityProvider !== 'DOCUMENSO' || !process.env.DOCUMENSO_ENCRYPTION_KEY) {
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
