import type { Subscription } from '@documenso/prisma/generated/zod/modelSchema/SubscriptionSchema';
import { OrganisationType } from '@prisma/client';

import { IS_BILLING_ENABLED } from '../constants/app';
import { AppError, AppErrorCode } from '../errors/app-error';
import { INTERNAL_CLAIM_ID } from '../types/subscription';

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

type PendingPaymentOrganisation = {
  type: OrganisationType;
  subscription?: unknown;
  organisationClaim: {
    originalSubscriptionClaimId: string | null;
  };
};

/**
 * Whether the organisation was created ahead of a paid checkout and is still awaiting
 * its first successful payment.
 *
 * Such organisations have no subscription row and still carry the copied "free" claim,
 * and must be treated as restricted until the Stripe webhook sync activates them.
 *
 * Always returns false when billing is disabled (self-hosted).
 */
export const isOrganisationPendingPayment = (organisation: PendingPaymentOrganisation) => {
  if (!IS_BILLING_ENABLED()) {
    return false;
  }

  if (organisation.type !== OrganisationType.ORGANISATION) {
    return false;
  }

  if (organisation.subscription) {
    return false;
  }

  return organisation.organisationClaim.originalSubscriptionClaimId === INTERNAL_CLAIM_ID.FREE;
};
