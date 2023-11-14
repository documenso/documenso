import { stripe } from '@documenso/lib/server-only/stripe';

export type GetProductByPriceIdOptions = {
  priceId: string;
};

export const getProductByPriceId = async ({ priceId }: GetProductByPriceIdOptions) => {
  const { product } = await stripe.prices.retrieve(priceId, {
    expand: ['product'],
  });

  if (typeof product === 'string' || 'deleted' in product) {
    throw new Error('Product not found');
  }

  return product;
};
