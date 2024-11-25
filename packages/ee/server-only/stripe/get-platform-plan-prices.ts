import { STRIPE_PLAN_TYPE } from '@documenso/lib/constants/billing';

import { getPricesByPlan } from './get-prices-by-plan';

export const getPlatformPlanPrices = async () => {
  return await getPricesByPlan(STRIPE_PLAN_TYPE.PLATFORM);
};

export const getPlatformPlanPriceIds = async () => {
  const prices = await getPlatformPlanPrices();

  return prices.map((price) => price.id);
};
