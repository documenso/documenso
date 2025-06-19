import type { Subscription } from '@documenso/prisma/generated/zod/modelSchema/SubscriptionSchema';

import { IS_BILLING_ENABLED } from '../constants/app';
import { AppErrorCode } from '../errors/app-error';
import { AppError } from '../errors/app-error';
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
  const isBillingEnabled = IS_BILLING_ENABLED();

  if (!isBillingEnabled) {
    return;
  }

  if (isBillingEnabled && !subscription) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Subscription not found',
    });
  }

  return subscription;
};
