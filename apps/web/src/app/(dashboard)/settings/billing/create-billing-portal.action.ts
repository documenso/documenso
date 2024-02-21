'use server';

import { getStripeCustomerByUser } from '@documenso/ee/server-only/stripe/get-customer';
import { getPortalSession } from '@documenso/ee/server-only/stripe/get-portal-session';
import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { getRequiredServerComponentSession } from '@documenso/lib/next-auth/get-server-component-session';

export const createBillingPortal = async () => {
  const { user } = await getRequiredServerComponentSession();

  const { stripeCustomer } = await getStripeCustomerByUser(user);

  return getPortalSession({
    customerId: stripeCustomer.id,
    returnUrl: `${NEXT_PUBLIC_WEBAPP_URL()}/settings/billing`,
  });
};
