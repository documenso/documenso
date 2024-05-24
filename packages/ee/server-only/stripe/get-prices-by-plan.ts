import type { STRIPE_PLAN_TYPE } from '@documenso/lib/constants/billing';
import { stripe } from '@documenso/lib/server-only/stripe';

type PlanType = (typeof STRIPE_PLAN_TYPE)[keyof typeof STRIPE_PLAN_TYPE];

export const getPricesByPlan = async (plan: PlanType | PlanType[]) => {
  const planTypes = typeof plan === 'string' ? [plan] : plan;

  const query = planTypes.map((planType) => `metadata['plan']:'${planType}'`).join(' OR ');

  const { data: prices } = await stripe.prices.search({
    query,
    expand: ['data.product'],
    limit: 100,
  });

  return prices.filter((price) => price.type === 'recurring');
};
