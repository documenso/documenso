/**
 * Stub implementation for getting product by price ID.
 * In the stub version, returns a basic product structure.
 */

export const getProductByPriceId = async ({ priceId }: { priceId: string }) => {
  return {
    id: 'stub-product-id',
    name: 'Stub Product',
    description: 'A stub product for development',
    features: ['Feature 1', 'Feature 2'],
  };
};
