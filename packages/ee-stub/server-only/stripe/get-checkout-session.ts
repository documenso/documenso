/**
 * Stub implementation for checkout session.
 * In the stub version, returns a mock redirect URL.
 */

export const getCheckoutSession = async ({
  customerId,
  priceId,
  mode = 'subscription',
  returnUrl,
  subscriptionMetadata,
}: {
  customerId: string;
  priceId?: string;
  mode?: 'subscription' | 'payment';
  returnUrl?: string;
  subscriptionMetadata?: Record<string, string>;
}) => {
  // Return a stub checkout session that will redirect to the home page or provided returnUrl
  return {
    url: returnUrl || '/',
  };
};
