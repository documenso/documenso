import { STRIPE_CUSTOMER_TYPE } from '@documenso/lib/constants/billing';
import { stripe } from '@documenso/lib/server-only/stripe';

type CreateTeamCustomerOptions = {
  name: string;
  email: string;
};

/**
 * Create a Stripe customer for a given team.
 */
export const createTeamCustomer = async ({ name, email }: CreateTeamCustomerOptions) => {
  return await stripe.customers.create({
    name,
    email,
    metadata: {
      type: STRIPE_CUSTOMER_TYPE.TEAM,
    },
  });
};
