import { STRIPE_CUSTOMER_TYPE } from '@documenso/lib/constants/billing';
import { stripe } from '@documenso/lib/server-only/stripe';

type CreateOrganisationCustomerOptions = {
  name: string;
  email: string;
};

/**
 * Create a Stripe customer for a given Organisation.
 */
export const createOrganisationCustomer = async ({
  name,
  email,
}: CreateOrganisationCustomerOptions) => {
  return await stripe.customers.create({
    name,
    email,
    metadata: {
      type: STRIPE_CUSTOMER_TYPE.ORGANISATION,
    },
  });
};
