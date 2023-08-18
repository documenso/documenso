import { redirect } from 'next/navigation';

import { getRequiredServerComponentSession } from '@documenso/lib/next-auth/get-server-session';

import { PasswordForm } from '~/components/forms/password';
import { getServerComponentFlag } from '~/helpers/get-server-component-feature-flag';

export default async function BillingSettingsPage() {
  const user = await getRequiredServerComponentSession();

  const isBillingEnabled = await getServerComponentFlag('billing');

  // Redirect if subscriptions are not enabled.
  if (!isBillingEnabled) {
    redirect('/settings/profile');
  }

  return (
    <div>
      <h3 className="text-lg font-medium">Billing</h3>

      <p className="mt-2 text-sm text-slate-500">
        Here you can update and manage your subscription.
      </p>

      <hr className="my-4" />

      <PasswordForm user={user} className="max-w-xl" />
    </div>
  );
}
