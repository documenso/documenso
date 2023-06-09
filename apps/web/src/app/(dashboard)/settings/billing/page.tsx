import { redirect } from 'next/navigation';

import { IS_SUBSCRIPTIONS_ENABLED } from '@documenso/lib/constants/features';
import { getRequiredServerComponentSession } from '@documenso/lib/next-auth/get-server-session';

import { PasswordForm } from '~/components/forms/password';

export default async function BillingSettingsPage() {
  const user = await getRequiredServerComponentSession();

  // Redirect if subscriptions are not enabled.
  if (!IS_SUBSCRIPTIONS_ENABLED) {
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
