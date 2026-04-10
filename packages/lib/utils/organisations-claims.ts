import { DEFAULT_MINIMUM_ENVELOPE_ITEM_COUNT } from '@documenso/ee/server-only/limits/constants';
import type { SubscriptionClaim } from '@prisma/client';

export const generateDefaultSubscriptionClaim = (): Omit<
  SubscriptionClaim,
  'id' | 'organisation' | 'createdAt' | 'updatedAt' | 'originalSubscriptionClaimId'
> => {
  return {
    name: '',
    teamCount: 1,
    memberCount: 1,
    envelopeItemCount: DEFAULT_MINIMUM_ENVELOPE_ITEM_COUNT,
    locked: false,
    flags: {},
  };
};
