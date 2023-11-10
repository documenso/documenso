'use server';

import { createCustomer } from '@documenso/ee/server-only/stripe/create-customer';
import { getCheckoutSession } from '@documenso/ee/server-only/stripe/get-checkout-session';
import {
  getStripeCustomerByEmail,
  getStripeCustomerById,
} from '@documenso/ee/server-only/stripe/get-customer';
import { getPortalSession } from '@documenso/ee/server-only/stripe/get-portal-session';
import { getRequiredServerComponentSession } from '@documenso/lib/next-auth/get-server-session';
import { Stripe } from '@documenso/lib/server-only/stripe';
import { getSubscriptionByUserId } from '@documenso/lib/server-only/subscription/get-subscription-by-user-id';

export type CreateCheckoutOptions = {
  priceId: string;
};

export const createCheckout = async ({ priceId }: CreateCheckoutOptions) => {
  const { user } = await getRequiredServerComponentSession();

  const existingSubscription = await getSubscriptionByUserId({ userId: user.id });

  let stripeCustomer: Stripe.Customer | null = null;

  // Find the Stripe customer for the current user subscription.
  if (existingSubscription) {
    stripeCustomer = await getStripeCustomerById(existingSubscription.customerId);

    if (!stripeCustomer) {
      throw new Error('Missing Stripe customer for subscription');
    }

    return getPortalSession({
      customerId: stripeCustomer.id,
      returnUrl: `${process.env.NEXT_PUBLIC_WEBAPP_URL}/settings/billing`,
    });
  }

  // Fallback to check if a Stripe customer already exists for the current user email.
  if (!stripeCustomer) {
    stripeCustomer = await getStripeCustomerByEmail(user.email);
  }

  // Create a Stripe customer if it does not exist for the current user.
  if (!stripeCustomer) {
    await createCustomer({
      user,
    });

    stripeCustomer = await getStripeCustomerByEmail(user.email);
  }

  return getCheckoutSession({
    customerId: stripeCustomer.id,
    priceId,
    returnUrl: `${process.env.NEXT_PUBLIC_WEBAPP_URL}/settings/billing`,
  });
};
