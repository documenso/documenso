/**
 * Stub implementation for transferring team subscription.
 * In the stub version, returns a sample subscription object.
 */
import type { User } from '@documenso/prisma/client';

export const transferTeamSubscription = async ({
  user,
  teamId,
  clearPaymentMethods,
}: {
  user: User;
  teamId: number;
  clearPaymentMethods: boolean;
}) => {
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
