'use server';

import { getCheckoutSession } from '@documenso/ee/server-only/stripe/get-checkout-session';
import { getStripeCustomerByUser } from '@documenso/ee/server-only/stripe/get-customer';
import { getPortalSession } from '@documenso/ee/server-only/stripe/get-portal-session';
import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { getRequiredServerComponentSession } from '@documenso/lib/next-auth/get-server-component-session';
import { getSubscriptionsByUserId } from '@documenso/lib/server-only/subscription/get-subscriptions-by-user-id';

export type CreateCheckoutOptions = {
  priceId: string;
};

export const createCheckout = async ({ priceId }: CreateCheckoutOptions) => {
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
    });
  }

  return getCheckoutSession({
    customerId: stripeCustomer.id,
    priceId,
    returnUrl: `${NEXT_PUBLIC_WEBAPP_URL()}/settings/billing`,
  });
};
