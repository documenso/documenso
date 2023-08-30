import { stripe } from '@documenso/lib/server-only/stripe';
import { getSubscriptionByUserId } from '@documenso/lib/server-only/subscription/get-subscription-by-user-id';
import { prisma } from '@documenso/prisma';
import { User } from '@documenso/prisma/client';

export type CreateCustomerOptions = {
  user: User;
};

export const createCustomer = async ({ user }: CreateCustomerOptions) => {
  const existingSubscription = await getSubscriptionByUserId({ userId: user.id });

  if (existingSubscription) {
    throw new Error('User already has a subscription');
  }

  const customer = await stripe.customers.create({
    name: user.name ?? undefined,
    email: user.email,
    metadata: {
      userId: user.id,
    },
  });

  return await prisma.subscription.create({
    data: {
      userId: user.id,
      customerId: customer.id,
    },
  });
};
