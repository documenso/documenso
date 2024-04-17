import { stripe } from '@documenso/lib/server-only/stripe';

type UpdateCustomerOptions = {
  customerId: string;
  name?: string;
  email?: string;
};

export const updateCustomer = async ({ customerId, name, email }: UpdateCustomerOptions) => {
  if (!name && !email) {
    return;
  }

  return await stripe.customers.update(customerId, {
    name,
    email,
  });
};
