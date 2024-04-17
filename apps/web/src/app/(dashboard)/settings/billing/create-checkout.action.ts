'use server';

import { getCheckoutSession } from '@documenso/ee/server-only/stripe/get-checkout-session';
<<<<<<< HEAD
import {
  getStripeCustomerByEmail,
  getStripeCustomerById,
} from '@documenso/ee/server-only/stripe/get-customer';
import { getPortalSession } from '@documenso/ee/server-only/stripe/get-portal-session';
import { getRequiredServerComponentSession } from '@documenso/lib/next-auth/get-server-session';
import { Stripe, stripe } from '@documenso/lib/server-only/stripe';
import { getSubscriptionByUserId } from '@documenso/lib/server-only/subscription/get-subscription-by-user-id';
=======
import { getStripeCustomerByUser } from '@documenso/ee/server-only/stripe/get-customer';
import { getPortalSession } from '@documenso/ee/server-only/stripe/get-portal-session';
import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { getRequiredServerComponentSession } from '@documenso/lib/next-auth/get-server-component-session';
import { getSubscriptionsByUserId } from '@documenso/lib/server-only/subscription/get-subscriptions-by-user-id';
>>>>>>> main

export type CreateCheckoutOptions = {
  priceId: string;
};

export const createCheckout = async ({ priceId }: CreateCheckoutOptions) => {
<<<<<<< HEAD
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
    stripeCustomer = await stripe.customers.create({
      name: user.name ?? undefined,
      email: user.email,
      metadata: {
        userId: user.id,
      },
=======
  const session = await getRequiredServerComponentSession();

  const { user, stripeCustomer } = await getStripeCustomerByUser(session.user);

  const existingSubscriptions = await getSubscriptionsByUserId({ userId: user.id });

  const foundSubscription = existingSubscriptions.find(
    (subscription) =>
      subscription.priceId === priceId &&
      subscription.periodEnd &&
      subscription.periodEnd >= new Date(),
  );

  if (foundSubscription) {
    return getPortalSession({
      customerId: stripeCustomer.id,
      returnUrl: `${NEXT_PUBLIC_WEBAPP_URL()}/settings/billing`,
>>>>>>> main
    });
  }

  return getCheckoutSession({
    customerId: stripeCustomer.id,
    priceId,
<<<<<<< HEAD
    returnUrl: `${process.env.NEXT_PUBLIC_WEBAPP_URL}/settings/billing`,
=======
    returnUrl: `${NEXT_PUBLIC_WEBAPP_URL()}/settings/billing`,
>>>>>>> main
  });
};
