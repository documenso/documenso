import type Stripe from 'stripe';

import { stripe } from '@documenso/lib/server-only/stripe';

// Utility type to handle usage of the `expand` option.
type PriceWithProduct = Stripe.Price & { product: Stripe.Product };

export type PriceIntervals = Record<Stripe.Price.Recurring.Interval, PriceWithProduct[]>;

export type GetPricesByIntervalOptions = {
  /**
   * Filter products by their meta 'plan' attribute.
   */
  plan?: 'community';
};

export const getPricesByInterval = async ({ plan }: GetPricesByIntervalOptions = {}) => {
  let { data: prices } = await stripe.prices.search({
    query: `active:'true' type:'recurring'`,
    expand: ['data.product'],
    limit: 100,
  });

  prices = prices.filter((price) => {
    // We use `expand` to get the product, but it's not typed as part of the Price type.
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const product = price.product as Stripe.Product;

    const filter = !plan || product.metadata?.plan === plan;

    // Filter out prices for products that are not active.
    return product.active && filter;
  });

  const intervals: PriceIntervals = {
    day: [],
    week: [],
    month: [],
    year: [],
  };

  // Add each price to the correct interval.
  for (const price of prices) {
    if (price.recurring?.interval) {
      // We use `expand` to get the product, but it's not typed as part of the Price type.
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      intervals[price.recurring.interval].push(price as PriceWithProduct);
    }
  }

  // Order all prices by unit_amount.
  intervals.day.sort((a, b) => Number(a.unit_amount) - Number(b.unit_amount));
  intervals.week.sort((a, b) => Number(a.unit_amount) - Number(b.unit_amount));
  intervals.month.sort((a, b) => Number(a.unit_amount) - Number(b.unit_amount));
  intervals.year.sort((a, b) => Number(a.unit_amount) - Number(b.unit_amount));

  return intervals;
};
