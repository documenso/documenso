import { env } from 'next-runtime-env';

import { IS_BILLING_ENABLED } from '../constants/app';
import type { Subscription } from '.prisma/client';
import { SubscriptionStatus } from '.prisma/client';

/**
 * Returns true if there is a subscription that is active and is one of the provided price IDs.
 */
export const subscriptionsContainsActivePlan = (
  subscriptions: Subscription[],
  priceIds: string[],
) => {
  return subscriptions.some(
    (subscription) =>
      subscription.status === SubscriptionStatus.ACTIVE && priceIds.includes(subscription.priceId),
  );
};
/**
 * Returns true if there is a subscription that is active and is one of the provided product IDs.
 */
export const subscriptionsContainsActiveProductId = (
  subscriptions: Subscription[],
  productId: string[],
) => {
  return subscriptions.some(
    (subscription) =>
      subscription.status === SubscriptionStatus.ACTIVE && productId.includes(subscription.planId),
  );
};

export const subscriptionsContainActiveEnterprisePlan = (
  subscriptions?: Subscription[],
): boolean => {
  const enterprisePlanId = env('NEXT_PUBLIC_STRIPE_ENTERPRISE_PLAN_MONTHLY_PRICE_ID');

  if (!enterprisePlanId || !subscriptions || !IS_BILLING_ENABLED()) {
    return false;
  }

  return subscriptionsContainsActivePlan(subscriptions, [enterprisePlanId]);
};
