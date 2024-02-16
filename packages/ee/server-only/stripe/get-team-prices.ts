import type Stripe from 'stripe';

import { STRIPE_PLAN_TYPE } from '@documenso/lib/constants/billing';
import { AppError } from '@documenso/lib/errors/app-error';

import { getPricesByPlan } from './get-prices-by-plan';

export const getTeamPrices = async () => {
  const prices = (await getPricesByPlan(STRIPE_PLAN_TYPE.TEAM)).filter((price) => price.active);

  const monthlyPrice = prices.find((price) => price.recurring?.interval === 'month');
  const yearlyPrice = prices.find((price) => price.recurring?.interval === 'year');
  const priceIds = prices.map((price) => price.id);

  if (!monthlyPrice || !yearlyPrice) {
    throw new AppError('INVALID_CONFIG', 'Missing monthly or yearly price');
  }

  return {
    monthly: {
      friendlyInterval: 'Monthly',
      interval: 'monthly',
      ...extractPriceData(monthlyPrice),
    },
    yearly: {
      friendlyInterval: 'Yearly',
      interval: 'yearly',
      ...extractPriceData(yearlyPrice),
    },
    priceIds,
  } as const;
};

const extractPriceData = (price: Stripe.Price) => {
  const product =
    typeof price.product !== 'string' && !price.product.deleted ? price.product : null;

  return {
    priceId: price.id,
    description: product?.description ?? '',
    features: product?.features ?? [],
  };
};
