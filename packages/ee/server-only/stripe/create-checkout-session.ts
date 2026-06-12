import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { stripe } from '@documenso/lib/server-only/stripe';

export type CreateCheckoutSessionOptions = {
  customerId: string;
  priceId: string;
  returnUrl: string;
};

export const createCheckoutSession = async ({ customerId, priceId, returnUrl }: CreateCheckoutSessionOptions) => {
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
    billing_address_collection: 'required',
  });

  if (!session.url) {
    throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
      message: 'Failed to create checkout session',
    });
  }

  return session.url;
};
