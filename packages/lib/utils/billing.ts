import { AppError } from '../errors/app-error';
import type { Subscription } from '.prisma/client';
import { SubscriptionStatus } from '.prisma/client';

export const isPriceIdCommunityPlan = (priceId: string) =>
  priceId === process.env.NEXT_PUBLIC_STRIPE_COMMUNITY_PLAN_MONTHLY_PRICE_ID ||
  priceId === process.env.NEXT_PUBLIC_STRIPE_COMMUNITY_PLAN_YEARLY_PRICE_ID;

/**
 * Returns true if there is a subscription that is active and is a community plan.
 */
export const isSomeSubscriptionsActiveAndCommunityPlan = (subscriptions: Subscription[]) => {
  return subscriptions.some(
    (subscription) =>
      subscription.status === SubscriptionStatus.ACTIVE &&
      isPriceIdCommunityPlan(subscription.planId),
  );
};

export const getTeamSeatPriceId = () => {
  if (!process.env.NEXT_PUBLIC_STRIPE_TEAM_SEAT_PRICE_ID) {
    throw new AppError('MISSING_STRIPE_TEAM_SEAT_PRICE_ID');
  }

  return process.env.NEXT_PUBLIC_STRIPE_TEAM_SEAT_PRICE_ID;
};
