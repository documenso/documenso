import { stripe } from '@documenso/lib/server-only/stripe';

export const getStripeCustomerById = async (stripeCustomerId: string) => {
  try {
    const stripeCustomer = await stripe.customers.retrieve(stripeCustomerId);

    return !stripeCustomer.deleted ? stripeCustomer : null;
  } catch {
    return null;
  }
};
