import { STRIPE_PLAN_TYPE } from '@documenso/lib/constants/billing';

import { getPricesByPlan } from './get-prices-by-plan';

export const getEnterprisePlanPrices = async () => {
  return await getPricesByPlan(STRIPE_PLAN_TYPE.ENTERPRISE);
};

export const getEnterprisePlanPriceIds = async () => {
  const prices = await getEnterprisePlanPrices();

  return prices.map((price) => price.id);
};
