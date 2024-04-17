'use server';

<<<<<<< HEAD
=======
import type Stripe from 'stripe';

>>>>>>> main
import { stripe } from '@documenso/lib/server-only/stripe';

export type GetCheckoutSessionOptions = {
  customerId: string;
  priceId: string;
  returnUrl: string;
<<<<<<< HEAD
=======
  subscriptionMetadata?: Stripe.Metadata;
>>>>>>> main
};

export const getCheckoutSession = async ({
  customerId,
  priceId,
  returnUrl,
<<<<<<< HEAD
=======
  subscriptionMetadata,
>>>>>>> main
}: GetCheckoutSessionOptions) => {
  'use server';

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
<<<<<<< HEAD
=======
    mode: 'subscription',
>>>>>>> main
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: `${returnUrl}?success=true`,
    cancel_url: `${returnUrl}?canceled=true`,
<<<<<<< HEAD
=======
    subscription_data: {
      metadata: subscriptionMetadata,
    },
>>>>>>> main
  });

  return session.url;
};
