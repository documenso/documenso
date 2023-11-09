import { redirect } from 'next/navigation';

import { match } from 'ts-pattern';

import { getPricesByInterval } from '@documenso/ee/server-only/stripe/get-prices-by-interval';
import { getProductByPriceId } from '@documenso/ee/server-only/stripe/get-product-by-price-id';
import { getRequiredServerComponentSession } from '@documenso/lib/next-auth/get-server-session';
import { getServerComponentFlag } from '@documenso/lib/server-only/feature-flags/get-server-component-feature-flag';
import { Stripe } from '@documenso/lib/server-only/stripe';
import { getSubscriptionByUserId } from '@documenso/lib/server-only/subscription/get-subscription-by-user-id';

import { LocaleDate } from '~/components/formatter/locale-date';

import { BillingPlans } from './billing-plans';
import { BillingPortalButton } from './billing-portal-button';

export default async function BillingSettingsPage() {
  const { user } = await getRequiredServerComponentSession();

  const isBillingEnabled = await getServerComponentFlag('app_billing');

  // Redirect if subscriptions are not enabled.
  if (!isBillingEnabled) {
    redirect('/settings/profile');
  }

  const [subscription, prices] = await Promise.all([
    getSubscriptionByUserId({ userId: user.id }),
    getPricesByInterval(),
  ]);

  let subscriptionProduct: Stripe.Product | null = null;

  if (subscription?.priceId) {
    subscriptionProduct = await getProductByPriceId({ priceId: subscription.priceId }).catch(
      () => null,
    );
  }

  const isMissingOrInactiveOrFreePlan = !subscription || subscription.status === 'INACTIVE';

  return (
    <div>
      <h3 className="text-lg font-medium">Billing</h3>

      <div className="text-muted-foreground mt-2 text-sm">
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

      {isMissingOrInactiveOrFreePlan ? <BillingPlans prices={prices} /> : <BillingPortalButton />}
    </div>
  );
}
