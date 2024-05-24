import { STRIPE_PLAN_TYPE } from '@documenso/lib/constants/billing';

import { getPricesByPlan } from './get-prices-by-plan';

/**
 * Returns the prices of items that count as the account's primary plan.
 */
export const getPrimaryAccountPlanPrices = async () => {
  return await getPricesByPlan([STRIPE_PLAN_TYPE.COMMUNITY, STRIPE_PLAN_TYPE.ENTERPRISE]);
};
