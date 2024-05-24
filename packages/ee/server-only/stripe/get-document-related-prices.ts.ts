import { STRIPE_PLAN_TYPE } from '@documenso/lib/constants/billing';

import { getPricesByPlan } from './get-prices-by-plan';

/**
 * Returns the Stripe prices of items that affect the amount of documents a user can create.
 */
export const getDocumentRelatedPrices = async () => {
  return await getPricesByPlan([STRIPE_PLAN_TYPE.COMMUNITY, STRIPE_PLAN_TYPE.ENTERPRISE]);
};
