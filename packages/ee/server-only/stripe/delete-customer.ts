import { stripe } from '@documenso/lib/server-only/stripe';
import type { User } from '@documenso/prisma/client';

export const deleteStripeCustomer = async (user: User) => {
  if (!user.customerId) {
    return null;
  }

  return await stripe.customers.del(user.customerId);
};
