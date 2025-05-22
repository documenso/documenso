import type { OrganisationClaim, SubscriptionClaim } from '@prisma/client';

export const generateDefaultOrganisationClaims = (): Omit<
  OrganisationClaim,
  'id' | 'organisation' | 'createdAt' | 'updatedAt' | 'originalSubscriptionClaimId'
> => {
  return {
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
