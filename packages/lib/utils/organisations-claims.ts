import type { OrganisationClaim, SubscriptionClaim } from '@prisma/client';

import { INTERNAL_CLAIM_ID } from '../types/subscription';

export const generateDefaultOrganisationClaims = (): Omit<
  OrganisationClaim,
  'organisation' | 'createdAt' | 'updatedAt' | 'originalSubscriptionClaimId'
> => {
  return {
    id: INTERNAL_CLAIM_ID.FREE,
    teamCount: 1,
    memberCount: 1,
    flags: {},
  };
};

export const generateDefaultSubscriptionClaim = (): Omit<
  SubscriptionClaim,
  'id' | 'organisation' | 'createdAt' | 'updatedAt' | 'originalSubscriptionClaimId'
> => {
  return {
    name: '',
    teamCount: 1,
    memberCount: 1,
    locked: false,
    flags: {},
  };
};
