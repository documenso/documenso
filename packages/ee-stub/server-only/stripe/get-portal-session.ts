/**
 * Stub implementation for portal session.
 * In the stub version, returns a mock redirect URL.
 */

export const getPortalSession = async ({
  customerId,
  returnUrl,
}: {
  customerId: string;
  returnUrl?: string;
}) => {
  // Return a stub portal session that will redirect to the home page or provided returnUrl
  return {
    url: returnUrl || '/',
  };
};
