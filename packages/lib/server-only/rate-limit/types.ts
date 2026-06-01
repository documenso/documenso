import type { OrganisationClaim, OrganisationMonthlyStat } from '@prisma/client';

export type LimitCounter = 'api' | 'document' | 'email';

export type LimitOptions = {
  organisationId: string;
  organisationClaim?: OrganisationClaim;
  monthlyStat?: OrganisationMonthlyStat;

  // Units to reserve. Default 1. Must be >= 1.
  count?: number;
};

export type RateLimitEntry = {
  window: `${number}${'s' | 'm' | 'h' | 'd'}`;
  max: number;
};
