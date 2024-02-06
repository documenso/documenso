import { STRIPE_PLAN_TYPE } from '@documenso/lib/constants/billing';

import { getPricesByPlan } from './get-prices-by-plan';

export const getCommunityPlanPrices = async () => {
  return await getPricesByPlan(STRIPE_PLAN_TYPE.COMMUNITY);
};

export const getCommunityPlanPriceIds = async () => {
  const prices = await getCommunityPlanPrices();

  return prices.map((price) => price.id);
};
