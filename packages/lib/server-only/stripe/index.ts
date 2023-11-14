/// <reference types="./stripe.d.ts" />
import Stripe from 'stripe';

export const stripe = new Stripe(process.env.NEXT_PRIVATE_STRIPE_API_KEY ?? '', {
  apiVersion: '2022-11-15',
  typescript: true,
});

export { Stripe };
