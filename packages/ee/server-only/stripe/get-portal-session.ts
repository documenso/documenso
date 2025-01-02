import { stripe } from '@documenso/lib/server-only/stripe';

export type GetPortalSessionOptions = {
  customerId: string;
  returnUrl?: string;
};

export const getPortalSession = async ({ customerId, returnUrl }: GetPortalSessionOptions) => {
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });

  return session.url;
};
