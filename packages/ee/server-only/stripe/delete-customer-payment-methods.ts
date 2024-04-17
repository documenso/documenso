import { stripe } from '@documenso/lib/server-only/stripe';

type DeleteCustomerPaymentMethodsOptions = {
  customerId: string;
};

/**
 * Delete all attached payment methods for a given customer.
 */
export const deleteCustomerPaymentMethods = async ({
  customerId,
}: DeleteCustomerPaymentMethodsOptions) => {
  const paymentMethods = await stripe.paymentMethods.list({
    customer: customerId,
  });

  await Promise.all(
    paymentMethods.data.map(async (paymentMethod) =>
      stripe.paymentMethods.detach(paymentMethod.id),
    ),
  );
};
