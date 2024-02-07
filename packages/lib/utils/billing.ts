import type { Subscription } from '.prisma/client';
import { SubscriptionStatus } from '.prisma/client';

/**
 * Returns true if there is a subscription that is active and is a community plan.
 */
export const subscriptionsContainsActiveCommunityPlan = (
  subscriptions: Subscription[],
  communityPlanPriceIds: string[],
) => {
  return subscriptions.some(
    (subscription) =>
      subscription.status === SubscriptionStatus.ACTIVE &&
      communityPlanPriceIds.includes(subscription.priceId),
  );
};
