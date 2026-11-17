import { OrganisationType } from '@prisma/client';

import { IS_BILLING_ENABLED } from '../constants/app';
import { INTERNAL_CLAIM_ID, type TClaimFlags } from '../types/subscription';

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

export const isEmbedSignaturePersistenceEnabled = (flags: TClaimFlags) => {
  return !IS_BILLING_ENABLED() || flags.embedSigningWhiteLabel === true;
};
