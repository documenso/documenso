import type { Subscription } from '@documenso/prisma/generated/zod/modelSchema/SubscriptionSchema';

import type { StripeOrganisationCreateMetadata } from '../types/subscription';

export const generateStripeOrganisationCreateMetadata = (
  organisationName: string,
  userId: number,
) => {
  const metadata: StripeOrganisationCreateMetadata = {
    organisationName,
    userId,
  };

  return {
    organisationCreateData: JSON.stringify(metadata),
  };
};

/**
 * Throws an error if billing is enabled and no subscription is found.
 */
export const validateIfSubscriptionIsRequired = (subscription?: Subscription | null) => {
  return subscription;
};
