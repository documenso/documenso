import type { OrganisationClaim } from '@prisma/client';

import { IS_DOCUMENSO_CLOUD } from '../constants/app';
import { ONE_HOUR } from '../constants/time';
import { INTERNAL_CLAIM_ID } from '../types/subscription';
import { env } from './env';

const NEW_ACCOUNT_PERIOD = ONE_HOUR * 48;

type OrganisationClaimPlan = Pick<OrganisationClaim, 'originalSubscriptionClaimId'>;

export type ShouldShowNewAccountWarningOptions = {
  userCreatedAt: Date;
  organisationClaim: OrganisationClaimPlan;
};

export const shouldShowNewAccountWarning = ({
  userCreatedAt,
  organisationClaim,
}: ShouldShowNewAccountWarningOptions) => {
  const isEnabled = IS_DOCUMENSO_CLOUD() || env('NEXT_PRIVATE_SHOW_NEW_ACCOUNT_EMAIL_WARNING') === 'true';

  if (!isEnabled || organisationClaim.originalSubscriptionClaimId !== INTERNAL_CLAIM_ID.FREE) {
    return false;
  }

  return Date.now() - userCreatedAt.getTime() < NEW_ACCOUNT_PERIOD;
};

export type ShouldDisableReportedSenderOptions = {
  user: {
    disabled: boolean;
    roles: Array<'ADMIN' | 'USER'>;
  };
  organisationClaim: OrganisationClaimPlan;
};

/**
 * Cloud only: every self-hosted organisation is on the free claim.
 */
export const shouldDisableReportedSender = ({ user, organisationClaim }: ShouldDisableReportedSenderOptions) => {
  if (!IS_DOCUMENSO_CLOUD() || user.disabled || user.roles.includes('ADMIN')) {
    return false;
  }

  return organisationClaim.originalSubscriptionClaimId === INTERNAL_CLAIM_ID.FREE;
};
