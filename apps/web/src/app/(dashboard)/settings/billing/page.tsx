import { redirect } from 'next/navigation';

import { match } from 'ts-pattern';

import { getRequiredServerComponentSession } from '@documenso/lib/next-auth/get-server-session';
import { Stripe, stripe } from '@documenso/lib/server-only/stripe';
import { getSubscriptionByUserId } from '@documenso/lib/server-only/subscription/get-subscription-by-user-id';

import { LocaleDate } from '~/components/formatter/locale-date';

import BillingPortalButton from './billing-portal-button';

export default async function BillingSettingsPage() {
  const { user } = await getRequiredServerComponentSession();

  const isBillingEnabled = await getServerComponentFlag('app_billing');

  // Redirect if subscriptions are not enabled.
  if (!isBillingEnabled) {
    redirect('/settings/profile');
  }

  const subscription = await getSubscriptionByUserId({ userId: user.id });

  let subscriptionProduct: Stripe.Product | null = null;

  if (subscription?.planId) {
    const foundSubscriptionProduct = (await stripe.products.list()).data.find(
      (item) => item.default_price === subscription.planId,
    );

    subscriptionProduct = foundSubscriptionProduct ?? null;
  }

  const isMissingOrInactiveOrFreePlan =
    !subscription ||
    subscription.status === 'INACTIVE' ||
    subscription?.planId === process.env.NEXT_PUBLIC_STRIPE_FREE_PLAN_ID;

  return (
    <div>
      <h3 className="text-lg font-medium">Billing</h3>

      <div className="mt-2 text-sm text-slate-500">
        {isMissingOrInactiveOrFreePlan && (
          <p>
            You are currently on the <span className="font-semibold">Free Plan</span>.
          </p>
        )}

        {!isMissingOrInactiveOrFreePlan &&
          match(subscription.status)
            .with('ACTIVE', () => (
              <p>
                {subscriptionProduct ? (
                  <span>
                    You are currently subscribed to{' '}
                    <span className="font-semibold">{subscriptionProduct.name}</span>
                  </span>
                ) : (
                  <span>You currently have an active plan</span>
                )}
                {subscription.periodEnd && (
                  <span>
                    {' '}
                    which is set to{' '}
                    {subscription.cancelAtPeriodEnd ? (
                      <span>
                        end on{' '}
                        <LocaleDate className="font-semibold" date={subscription.periodEnd} />.
                      </span>
                    ) : (
                      <span>
                        automatically renew on{' '}
                        <LocaleDate className="font-semibold" date={subscription.periodEnd} />.
                      </span>
                    )}
                  </span>
                )}
              </p>
            ))
            .with('PAST_DUE', () => (
              <p>Your current plan is past due. Please update your payment information.</p>
            ))
            .otherwise(() => null)}
      </div>

      <hr className="my-4" />

      <BillingPortalButton />
    </div>
  );
}
