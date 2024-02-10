import { stripe } from '@documenso/lib/server-only/stripe';

export type GetInvoicesOptions = {
  customerId: string;
};

export const getInvoices = async ({ customerId }: GetInvoicesOptions) => {
  return await stripe.invoices.list({
    customer: customerId,
  });
};
