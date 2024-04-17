'use server';

import { stripe } from '@documenso/lib/server-only/stripe';

export type GetPortalSessionOptions = {
  customerId: string;
<<<<<<< HEAD
  returnUrl: string;
=======
  returnUrl?: string;
>>>>>>> main
};

export const getPortalSession = async ({ customerId, returnUrl }: GetPortalSessionOptions) => {
  'use server';

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });

  return session.url;
};
