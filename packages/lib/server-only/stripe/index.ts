import Stripe from 'stripe';

// eslint-disable-next-line turbo/no-undeclared-env-vars
export const stripe = new Stripe(process.env.NEXT_PRIVATE_STRIPE_API_KEY!, {
  apiVersion: '2022-11-15',
  typescript: true,
});

export { Stripe };
