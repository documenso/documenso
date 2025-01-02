import type { User } from '@prisma/client';

import { getCheckoutSession } from '@documenso/ee/server-only/stripe/get-checkout-session';
import { getStripeCustomerByUser } from '@documenso/ee/server-only/stripe/get-customer';
import { getPortalSession } from '@documenso/ee/server-only/stripe/get-portal-session';
import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';

import { getSubscriptionsByUserId } from '../subscription/get-subscriptions-by-user-id';

export type CreateCheckoutSession = {
  user: Pick<User, 'id' | 'customerId' | 'email' | 'name'>;
  priceId: string;
};

export const createCheckoutSession = async ({ user, priceId }: CreateCheckoutSession) => {
  const { stripeCustomer } = await getStripeCustomerByUser(user);

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
