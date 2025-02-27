import type { STRIPE_PLAN_TYPE } from '@documenso/lib/constants/billing';
import { stripe } from '@documenso/lib/server-only/stripe';

type PlanType = (typeof STRIPE_PLAN_TYPE)[keyof typeof STRIPE_PLAN_TYPE];

export const getPricesByPlan = async (plan: PlanType | PlanType[]) => {
  const planTypes: string[] = typeof plan === 'string' ? [plan] : plan;

  const prices = await stripe.prices.list({
    expand: ['data.product'],
    limit: 100,
  });

  return prices.data.filter(
    (price) => price.type === 'recurring' && planTypes.includes(price.metadata.plan),
  );
};
