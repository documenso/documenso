import { STRIPE_PLAN_TYPE } from '@documenso/lib/constants/billing';

import { getPricesByPlan } from './get-prices-by-plan';

/**
 * Returns the Stripe prices of items that affect the amount of teams a user can create.
 */
export const getTeamRelatedPrices = async () => {
  return await getPricesByPlan([STRIPE_PLAN_TYPE.COMMUNITY, STRIPE_PLAN_TYPE.ENTERPRISE]);
};

/**
 * Returns the Stripe price IDs of items that affect the amount of teams a user can create.
 */
export const getTeamRelatedPriceIds = async () => {
  return await getTeamRelatedPrices().then((prices) => prices.map((price) => price.id));
};
