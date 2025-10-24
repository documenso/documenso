import type { SubscriptionClaim } from '@prisma/client';
import { z } from 'zod';

import { ZOrganisationNameSchema } from '@documenso/trpc/server/organisation-router/create-organisation.types';

/**
 * README:
 * - If you update this you MUST update the `backport-subscription-claims` schema as well.
 */
export const ZClaimFlagsSchema = z.object({
  /**
   * Allows disabling of Documenso branding for:
   * - Certificates
   * - Emails
   * - Other?
   */
  allowCustomBranding: z.boolean().optional(),
  hidePoweredBy: z.boolean().optional(),

  unlimitedDocuments: z.boolean().optional(),

  emailDomains: z.boolean().optional(),

  embedAuthoring: z.boolean().optional(),
  embedAuthoringWhiteLabel: z.boolean().optional(),

  embedSigning: z.boolean().optional(),
  embedSigningWhiteLabel: z.boolean().optional(),

  cfr21: z.boolean().optional(),

  authenticationPortal: z.boolean().optional(),

  allowEnvelopes: z.boolean().optional(),
});

export type TClaimFlags = z.infer<typeof ZClaimFlagsSchema>;

// When adding keys, update internal documentation with this.
export const SUBSCRIPTION_CLAIM_FEATURE_FLAGS: Record<
  keyof TClaimFlags,
  {
    label: string;
    key: keyof TClaimFlags;
  }
> = {
  unlimitedDocuments: {
    key: 'unlimitedDocuments',
    label: 'Unlimited documents',
  },
  allowCustomBranding: {
    key: 'allowCustomBranding',
    label: 'Branding',
  },
  hidePoweredBy: {
    key: 'hidePoweredBy',
    label: 'Hide Documenso branding by',
  },
  emailDomains: {
    key: 'emailDomains',
    label: 'Email domains',
  },
  embedAuthoring: {
    key: 'embedAuthoring',
    label: 'Embed authoring',
  },
  embedSigning: {
    key: 'embedSigning',
    label: 'Embed signing',
  },
  embedAuthoringWhiteLabel: {
    key: 'embedAuthoringWhiteLabel',
    label: 'White label for embed authoring',
  },
  embedSigningWhiteLabel: {
    key: 'embedSigningWhiteLabel',
    label: 'White label for embed signing',
  },
  cfr21: {
    key: 'cfr21',
    label: '21 CFR',
  },
  authenticationPortal: {
    key: 'authenticationPortal',
    label: 'Authentication portal',
  },
  allowEnvelopes: {
    key: 'allowEnvelopes',
    label: 'Allow envelopes',
  },
};

export enum INTERNAL_CLAIM_ID {
  FREE = 'free',
  INDIVIDUAL = 'individual',
  TEAM = 'team',
  EARLY_ADOPTER = 'earlyAdopter',
  PLATFORM = 'platform',
  ENTERPRISE = 'enterprise',
}

export type InternalClaim = Omit<SubscriptionClaim, 'createdAt' | 'updatedAt'>;

export type InternalClaims = {
  [key in INTERNAL_CLAIM_ID]: InternalClaim;
};

export const internalClaims: InternalClaims = {
  [INTERNAL_CLAIM_ID.FREE]: {
    id: INTERNAL_CLAIM_ID.FREE,
    name: 'Free',
    teamCount: 1,
    memberCount: 1,
    envelopeItemCount: 5,
    locked: true,
    flags: {},
  },
  [INTERNAL_CLAIM_ID.INDIVIDUAL]: {
    id: INTERNAL_CLAIM_ID.INDIVIDUAL,
    name: 'Individual',
    teamCount: 1,
    memberCount: 1,
    envelopeItemCount: 5,
    locked: true,
    flags: {
      unlimitedDocuments: true,
    },
  },
  [INTERNAL_CLAIM_ID.TEAM]: {
    id: INTERNAL_CLAIM_ID.TEAM,
    name: 'Teams',
    teamCount: 1,
    memberCount: 5,
    envelopeItemCount: 5,
    locked: true,
    flags: {
      unlimitedDocuments: true,
      allowCustomBranding: true,
      embedSigning: true,
    },
  },
  [INTERNAL_CLAIM_ID.PLATFORM]: {
    id: INTERNAL_CLAIM_ID.PLATFORM,
    name: 'Platform',
    teamCount: 1,
    memberCount: 0,
    envelopeItemCount: 10,
    locked: true,
    flags: {
      unlimitedDocuments: true,
      allowCustomBranding: true,
      hidePoweredBy: true,
      emailDomains: false,
      embedAuthoring: false,
      embedAuthoringWhiteLabel: true,
      embedSigning: false,
      embedSigningWhiteLabel: true,
    },
  },
  [INTERNAL_CLAIM_ID.ENTERPRISE]: {
    id: INTERNAL_CLAIM_ID.ENTERPRISE,
    name: 'Enterprise',
    teamCount: 0,
    memberCount: 0,
    envelopeItemCount: 10,
    locked: true,
    flags: {
      unlimitedDocuments: true,
      allowCustomBranding: true,
      hidePoweredBy: true,
      emailDomains: true,
      embedAuthoring: true,
      embedAuthoringWhiteLabel: true,
      embedSigning: true,
      embedSigningWhiteLabel: true,
      cfr21: true,
      authenticationPortal: true,
    },
  },
  [INTERNAL_CLAIM_ID.EARLY_ADOPTER]: {
    id: INTERNAL_CLAIM_ID.EARLY_ADOPTER,
    name: 'Early Adopter',
    teamCount: 0,
    memberCount: 0,
    envelopeItemCount: 5,
    locked: true,
    flags: {
      unlimitedDocuments: true,
      allowCustomBranding: true,
      hidePoweredBy: true,
      embedSigning: true,
      embedSigningWhiteLabel: true,
    },
  },
} as const;

export const ZStripeOrganisationCreateMetadataSchema = z.object({
  organisationName: ZOrganisationNameSchema,
  userId: z.number(),
});

export type StripeOrganisationCreateMetadata = z.infer<
  typeof ZStripeOrganisationCreateMetadataSchema
>;
