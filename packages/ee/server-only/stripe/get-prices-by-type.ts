import { stripe } from '@documenso/lib/server-only/stripe';

export const getPricesByType = async (type: 'individual') => {
  const { data: prices } = await stripe.prices.search({
    query: `metadata['type']:'${type}' type:'recurring'`,
    expand: ['data.product'],
    limit: 100,
  });

  return prices;
};
