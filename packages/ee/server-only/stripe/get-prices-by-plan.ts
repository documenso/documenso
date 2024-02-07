import type { STRIPE_PLAN_TYPE } from '@documenso/lib/constants/billing';
import { stripe } from '@documenso/lib/server-only/stripe';

export const getPricesByPlan = async (
  plan: (typeof STRIPE_PLAN_TYPE)[keyof typeof STRIPE_PLAN_TYPE],
) => {
  const { data: prices } = await stripe.prices.search({
    query: `metadata['plan']:'${plan}' type:'recurring'`,
    expand: ['data.product'],
    limit: 100,
  });

  return prices;
};
