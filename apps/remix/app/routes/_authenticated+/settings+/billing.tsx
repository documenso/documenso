import { Trans, useLingui } from '@lingui/react/macro';
import { SubscriptionStatus } from '@prisma/client';
import { redirect } from 'react-router';
import { match } from 'ts-pattern';

import { getSession } from '@documenso/auth/server/lib/utils/get-session';
import { getStripeCustomerByUser } from '@documenso/ee/server-only/stripe/get-customer';
import { getPricesByInterval } from '@documenso/ee/server-only/stripe/get-prices-by-interval';
import { getPrimaryAccountPlanPrices } from '@documenso/ee/server-only/stripe/get-primary-account-plan-prices';
import { getProductByPriceId } from '@documenso/ee/server-only/stripe/get-product-by-price-id';
import { IS_BILLING_ENABLED } from '@documenso/lib/constants/app';
import { STRIPE_PLAN_TYPE } from '@documenso/lib/constants/billing';
import { type Stripe } from '@documenso/lib/server-only/stripe';
import { getSubscriptionsByUserId } from '@documenso/lib/server-only/subscription/get-subscriptions-by-user-id';

import { BillingPlans } from '~/components/general/billing-plans';
import { BillingPortalButton } from '~/components/general/billing-portal-button';
import { appMetaTags } from '~/utils/meta';
import { superLoaderJson, useSuperLoaderData } from '~/utils/super-json-loader';

import type { Route } from './+types/billing';

export function meta() {
  return appMetaTags('Billing');
}

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await getSession(request);

  // Redirect if subscriptions are not enabled.
  if (!IS_BILLING_ENABLED()) {
    throw redirect('/settings/profile');
  }

  if (!user.customerId) {
    await getStripeCustomerByUser(user).then((result) => result.user);
  }

  const [subscriptions, prices, primaryAccountPlanPrices] = await Promise.all([
    getSubscriptionsByUserId({ userId: user.id }),
    getPricesByInterval({ plans: [STRIPE_PLAN_TYPE.REGULAR, STRIPE_PLAN_TYPE.PLATFORM] }),
    getPrimaryAccountPlanPrices(),
  ]);

  const primaryAccountPlanPriceIds = primaryAccountPlanPrices.map(({ id }) => id);

  let subscriptionProduct: Stripe.Product | null = null;

  const primaryAccountPlanSubscriptions = subscriptions.filter(({ priceId }) =>
    primaryAccountPlanPriceIds.includes(priceId),
  );

  const subscription =
    primaryAccountPlanSubscriptions.find(({ status }) => status === SubscriptionStatus.ACTIVE) ??
    primaryAccountPlanSubscriptions[0];

  if (subscription?.priceId) {
    subscriptionProduct = await getProductByPriceId({ priceId: subscription.priceId }).catch(
      () => null,
    );
  }

  const isMissingOrInactiveOrFreePlan =
    !subscription || subscription.status === SubscriptionStatus.INACTIVE;

  return superLoaderJson({
    prices,
    subscription,
    subscriptionProductName: subscriptionProduct?.name,
    isMissingOrInactiveOrFreePlan,
  });
}

export default function TeamsSettingBillingPage() {
  const { prices, subscription, subscriptionProductName, isMissingOrInactiveOrFreePlan } =
    useSuperLoaderData<typeof loader>();

  const { i18n } = useLingui();

  return (
    <div>
      <div className="flex flex-row items-end justify-between">
        <div>
          <h3 className="text-2xl font-semibold">
            <Trans>Billing</Trans>
          </h3>

          <div className="text-muted-foreground mt-2 text-sm">
            {isMissingOrInactiveOrFreePlan && (
              <p>
                <Trans>
                  You are currently on the <span className="font-semibold">Free Plan</span>.
                </Trans>
              </p>
            )}

            {/* Todo: Translation */}
            {!isMissingOrInactiveOrFreePlan &&
              match(subscription.status)
                .with('ACTIVE', () => (
                  <p>
                    {subscriptionProductName ? (
                      <span>
                        You are currently subscribed to{' '}
                        <span className="font-semibold">{subscriptionProductName}</span>
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
                            <span className="font-semibold">
                              {i18n.date(subscription.periodEnd)}.
                            </span>
                          </span>
                        ) : (
                          <span>
                            automatically renew on{' '}
                            <span className="font-semibold">
                              {i18n.date(subscription.periodEnd)}.
                            </span>
                          </span>
                        )}
                      </span>
                    )}
                  </p>
                ))
                .with('PAST_DUE', () => (
                  <p>
                    <Trans>
                      Your current plan is past due. Please update your payment information.
                    </Trans>
                  </p>
                ))
                .otherwise(() => null)}
          </div>
        </div>

        {isMissingOrInactiveOrFreePlan && (
          <BillingPortalButton>
            <Trans>Manage billing</Trans>
          </BillingPortalButton>
        )}
      </div>

      <hr className="my-4" />

      {isMissingOrInactiveOrFreePlan ? <BillingPlans prices={prices} /> : <BillingPortalButton />}
    </div>
  );
}
