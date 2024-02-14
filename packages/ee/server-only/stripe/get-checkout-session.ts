'use server';

import type Stripe from 'stripe';

import { stripe } from '@documenso/lib/server-only/stripe';

export type GetCheckoutSessionOptions = {
  customerId: string;
  priceId: string;
  returnUrl: string;
  subscriptionMetadata?: Stripe.Metadata;
};

export const getCheckoutSession = async ({
  customerId,
  priceId,
  returnUrl,
  subscriptionMetadata,
}: GetCheckoutSessionOptions) => {
  'use server';

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: `${returnUrl}?success=true`,
    cancel_url: `${returnUrl}?canceled=true`,
    subscription_data: {
      metadata: subscriptionMetadata,
    },
  });

  return session.url;
};
