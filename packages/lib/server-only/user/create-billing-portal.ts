import type { User } from '@prisma/client';

import { getStripeCustomerByUser } from '@documenso/ee/server-only/stripe/get-customer';
import { getPortalSession } from '@documenso/ee/server-only/stripe/get-portal-session';
import { IS_BILLING_ENABLED, NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';

export type CreateBillingPortalOptions = {
  user: Pick<User, 'id' | 'customerId' | 'email' | 'name'>;
};

export const createBillingPortal = async ({ user }: CreateBillingPortalOptions) => {
  if (!IS_BILLING_ENABLED()) {
    throw new Error('Billing is not enabled');
  }

  const { stripeCustomer } = await getStripeCustomerByUser(user);

  return getPortalSession({
    customerId: stripeCustomer.id,
    returnUrl: `${NEXT_PUBLIC_WEBAPP_URL()}/settings/billing`,
  });
};
