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
