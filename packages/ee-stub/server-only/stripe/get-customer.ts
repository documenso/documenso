/**
 * Stub implementation of the Stripe customer functions.
 * In the stub version, returns a dummy Stripe customer.
 */
import type { User } from '@documenso/prisma/client';

export const getStripeCustomerByEmail = async ({ email }: { email: string }) => {
  return null;
};

export const getStripeCustomerById = async ({ customerId }: { customerId: string }) => {
  return null;
};

export const getStripeCustomerByUser = async (
  user: Pick<User, 'id' | 'customerId' | 'email' | 'name'> | User,
) => {
  return {
    id: 'cus_stub',
    email: user.email,
    name: user.name,
    created: Date.now() / 1000,
    subscriptions: { data: [] },
    user: user,
  };
};

export const getStripeCustomerIdByUser = async (
  user: Pick<User, 'id' | 'customerId' | 'email' | 'name'> | User,
) => {
  return 'cus_stub';
};

export const syncStripeCustomerSubscriptions = async ({
  userId,
  customerId,
}: {
  userId: string;
  customerId: string;
}) => {
  return;
};
