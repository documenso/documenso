'use server';

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
>>>>>>> main

export const createBillingPortal = async () => {
  const { user } = await getRequiredServerComponentSession();

<<<<<<< HEAD
  const existingSubscription = await getSubscriptionByUserId({ userId: user.id });

  let stripeCustomer: Stripe.Customer | null = null;

  // Find the Stripe customer for the current user subscription.
  if (existingSubscription) {
    stripeCustomer = await getStripeCustomerById(existingSubscription.customerId);

    if (!stripeCustomer) {
      throw new Error('Missing Stripe customer for subscription');
    }
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
    });
  }

  return getPortalSession({
    customerId: stripeCustomer.id,
    returnUrl: `${process.env.NEXT_PUBLIC_WEBAPP_URL}/settings/billing`,
=======
  const { stripeCustomer } = await getStripeCustomerByUser(user);

  return getPortalSession({
    customerId: stripeCustomer.id,
    returnUrl: `${NEXT_PUBLIC_WEBAPP_URL()}/settings/billing`,
>>>>>>> main
  });
};
