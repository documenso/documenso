'use server';

import {
  getStripeCustomerByEmail,
  getStripeCustomerById,
} from '@documenso/ee/server-only/stripe/get-customer';
import { getPortalSession } from '@documenso/ee/server-only/stripe/get-portal-session';
import { getRequiredServerComponentSession } from '@documenso/lib/next-auth/get-server-session';
import { Stripe, stripe } from '@documenso/lib/server-only/stripe';
import { getSubscriptionByUserId } from '@documenso/lib/server-only/subscription/get-subscription-by-user-id';
import { getRuntimeEnv } from '@documenso/lib/universal/runtime-env/get-runtime-env';

export const createBillingPortal = async () => {
  const { user } = await getRequiredServerComponentSession();

  const { NEXT_PUBLIC_WEBAPP_URL } = getRuntimeEnv();

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
    returnUrl: `${NEXT_PUBLIC_WEBAPP_URL}/settings/billing`,
  });
};
