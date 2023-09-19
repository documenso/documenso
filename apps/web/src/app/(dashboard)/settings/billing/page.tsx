import Link from 'next/link';
import { redirect } from 'next/navigation';

import { createCustomer } from '@documenso/ee/server-only/stripe/create-customer';
import { getPortalSession } from '@documenso/ee/server-only/stripe/get-portal-session';
import { getRequiredServerComponentSession } from '@documenso/lib/next-auth/get-server-session';
import { getSubscriptionByUserId } from '@documenso/lib/server-only/subscription/get-subscription-by-user-id';
import { SubscriptionStatus } from '@documenso/prisma/client';
import { Button } from '@documenso/ui/primitives/button';

import { LocaleDate } from '~/components/formatter/locale-date';
import { getServerComponentFlag } from '~/helpers/get-server-component-feature-flag';

export default async function BillingSettingsPage() {
  const user = await getRequiredServerComponentSession();

  const isBillingEnabled = await getServerComponentFlag('app_billing');

  // Redirect if subscriptions are not enabled.
  if (!isBillingEnabled) {
    redirect('/settings/profile');
  }

  const subscription = await getSubscriptionByUserId({ userId: user.id }).then(async (sub) => {
    if (sub) {
      return sub;
    }

    // If we don't have a customer record, create one as well as an empty subscription.
    return createCustomer({ user });
  });

  let billingPortalUrl = '';

  if (subscription.customerId) {
    billingPortalUrl = await getPortalSession({
      customerId: subscription.customerId,
      returnUrl: `${process.env.NEXT_PUBLIC_WEBAPP_URL}/settings/billing`,
    });
  }

  return (
    <div>
      <h3 className="text-lg font-medium">Billing</h3>

      <p className="mt-2 text-sm text-slate-500">
        Your subscription is{' '}
        {subscription.status !== SubscriptionStatus.INACTIVE ? 'active' : 'inactive'}.
        {subscription?.periodEnd && (
          <>
            {' '}
            Your next payment is due on{' '}
            <span className="font-semibold">
              <LocaleDate date={subscription.periodEnd} />
            </span>
            .
          </>
        )}
      </p>

      <hr className="my-4" />

      {billingPortalUrl && (
        <Button asChild>
          <Link href={billingPortalUrl}>Manage Subscription</Link>
        </Button>
      )}

      {!billingPortalUrl && (
        <p className="max-w-[60ch] text-base text-slate-500">
          You do not currently have a customer record, this should not happen. Please contact
          support for assistance.
        </p>
      )}
    </div>
  );
}
