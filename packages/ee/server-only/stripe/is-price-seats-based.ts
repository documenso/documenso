import type { Stripe } from '@documenso/lib/server-only/stripe';
import { stripe } from '@documenso/lib/server-only/stripe';

export const isPriceSeatsBased = async (priceId: string) => {
  const foundStripePrice = await stripe.prices.retrieve(priceId, {
    expand: ['product'],
  });

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const product = foundStripePrice.product as Stripe.Product;

  return product.metadata.isSeatBased === 'true';
};
