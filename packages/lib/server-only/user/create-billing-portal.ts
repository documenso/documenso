import { IS_BILLING_ENABLED, NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';

import type { User } from '@prisma/client';
import { getPortalSession } from '@documenso/ee-stub/server-only/stripe/get-portal-session';
import { getStripeCustomerByUser } from '@documenso/ee-stub/server-only/stripe/get-customer';

export type CreateBillingPortalOptions = {
  user: Pick<User, 'id' | 'customerId' | 'email' | 'name'>;
};

export const createBillingPortal = async ({ user }: CreateBillingPortalOptions) => {
  if (!IS_BILLING_ENABLED()) {
    throw new Error('Billing is not enabled');
  }

  const customer = await getStripeCustomerByUser({
    id: user.id,
    name: user.name,
    email: user.email,
    customerId: user.customerId,
  });

  return getPortalSession({
    customerId: customer.id,
    returnUrl: `${NEXT_PUBLIC_WEBAPP_URL()}/settings/billing`,
  });
};
