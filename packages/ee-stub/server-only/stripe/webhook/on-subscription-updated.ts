/**
 * Stub implementation for subscription update handler.
 * In the stub version, returns a minimal subscription object.
 */

export const mapStripeSubscriptionToPrismaUpsertAction = (
  subscription: any,
  userId?: number | undefined,
  teamId?: number | undefined,
) => {
  return {
    created: new Date(),
    updated: new Date(),
    customerId: 'cus_stub',
    subscriptionId: 'sub_stub',
    status: 'active',
    priceId: 'price_stub',
    quantity: 1,
    currentPeriodStart: new Date(),
    currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
    cancelAtPeriodEnd: false,
  };
};
