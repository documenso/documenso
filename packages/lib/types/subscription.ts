import { ZOrganisationNameSchema } from '@documenso/trpc/server/organisation-router/create-organisation.types';
import type { SubscriptionClaim } from '@prisma/client';
import { z } from 'zod';

/**
 * Rate limit window schema.
 *
 * Example: "5m", "1h", "1d"
 */
export const ZRateLimitWindowSchema = z.string().regex(/^\d+[smhd]$/);

export const ZRateLimitArraySchema = z.array(
  z.object({
    window: ZRateLimitWindowSchema,
    max: z.number().int().positive(),
  }),
);

export type TRateLimitArray = z.infer<typeof ZRateLimitArraySchema>;

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

  hipaa: z.boolean().optional(),

  authenticationPortal: z.boolean().optional(),

  allowLegacyEnvelopes: z.boolean().optional(),

  signingReminders: z.boolean().optional(),
});

export type TClaimFlags = z.infer<typeof ZClaimFlagsSchema>;

// When adding keys, update internal documentation with this.
export const SUBSCRIPTION_CLAIM_FEATURE_FLAGS: Record<
  keyof TClaimFlags,
  {
    label: string;
    key: keyof TClaimFlags;
    isEnterprise?: boolean;
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
    isEnterprise: true,
  },
  embedAuthoring: {
    key: 'embedAuthoring',
    label: 'Embed authoring',
    isEnterprise: true,
  },
  embedSigning: {
    key: 'embedSigning',
    label: 'Embed signing',
  },
  embedAuthoringWhiteLabel: {
    key: 'embedAuthoringWhiteLabel',
    label: 'White label for embed authoring',
    isEnterprise: true,
  },
  embedSigningWhiteLabel: {
    key: 'embedSigningWhiteLabel',
    label: 'White label for embed signing',
  },
  cfr21: {
    key: 'cfr21',
    label: '21 CFR',
    isEnterprise: true,
  },
  hipaa: {
    key: 'hipaa',
    label: 'HIPAA',
    isEnterprise: true,
  },
  authenticationPortal: {
    key: 'authenticationPortal',
    label: 'Authentication portal',
    isEnterprise: true,
  },
  allowLegacyEnvelopes: {
    key: 'allowLegacyEnvelopes',
    label: 'Allow Legacy Envelopes',
  },
  signingReminders: {
    key: 'signingReminders',
    label: 'Signing reminders',
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

/**
 * TODO: THIS NEEDS A REWORK
 *
 * Only the values within "free" claim (flags, etc) are directly used, the rest are taken
 * from the actual SubscriptionClaim in the database.
 *
 * We need to remove all the content besides id/name and fetch free from the database.
 */
export const internalClaims: InternalClaims = {
  /**
   * Free plan has no rates and quotas since this may break self-hosters.
   */
  [INTERNAL_CLAIM_ID.FREE]: {
    id: INTERNAL_CLAIM_ID.FREE,
    name: 'Free',
    teamCount: 1,
    memberCount: 1,
    envelopeItemCount: 5,
    recipientCount: 0,
    locked: true,
    flags: {},
    documentRateLimits: [],
    documentQuota: null,
    emailRateLimits: [],
    emailQuota: null,
    apiRateLimits: [],
    apiQuota: null,
  },
  [INTERNAL_CLAIM_ID.INDIVIDUAL]: {
    id: INTERNAL_CLAIM_ID.INDIVIDUAL,
    name: 'Individual',
    teamCount: 1,
    memberCount: 1,
    envelopeItemCount: 5,
    recipientCount: 0,
    locked: true,
    flags: {
      unlimitedDocuments: true,
      signingReminders: true,
    },
    documentRateLimits: [],
    documentQuota: null,
    emailRateLimits: [],
    emailQuota: null,
    apiRateLimits: [],
    apiQuota: null,
  },
  [INTERNAL_CLAIM_ID.TEAM]: {
    id: INTERNAL_CLAIM_ID.TEAM,
    name: 'Teams',
    teamCount: 1,
    memberCount: 5,
    envelopeItemCount: 5,
    recipientCount: 0,
    locked: true,
    flags: {
      unlimitedDocuments: true,
      allowCustomBranding: true,
      embedSigning: true,
      signingReminders: true,
    },
    documentRateLimits: [],
    documentQuota: null,
    emailRateLimits: [],
    emailQuota: null,
    apiRateLimits: [],
    apiQuota: null,
  },
  [INTERNAL_CLAIM_ID.PLATFORM]: {
    id: INTERNAL_CLAIM_ID.PLATFORM,
    name: 'Platform',
    teamCount: 1,
    memberCount: 0,
    envelopeItemCount: 10,
    recipientCount: 0,
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
      signingReminders: true,
    },
    documentRateLimits: [],
    documentQuota: null,
    emailRateLimits: [],
    emailQuota: null,
    apiRateLimits: [],
    apiQuota: null,
  },
  [INTERNAL_CLAIM_ID.ENTERPRISE]: {
    id: INTERNAL_CLAIM_ID.ENTERPRISE,
    name: 'Enterprise',
    teamCount: 0,
    memberCount: 0,
    envelopeItemCount: 10,
    recipientCount: 0,
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
      signingReminders: true,
    },
    documentRateLimits: [],
    documentQuota: null,
    emailRateLimits: [],
    emailQuota: null,
    apiRateLimits: [],
    apiQuota: null,
  },
  [INTERNAL_CLAIM_ID.EARLY_ADOPTER]: {
    id: INTERNAL_CLAIM_ID.EARLY_ADOPTER,
    name: 'Early Adopter',
    teamCount: 0,
    memberCount: 0,
    envelopeItemCount: 5,
    recipientCount: 0,
    locked: true,
    flags: {
      unlimitedDocuments: true,
      allowCustomBranding: true,
      hidePoweredBy: true,
      embedSigning: true,
      embedSigningWhiteLabel: true,
      signingReminders: true,
    },
    documentRateLimits: [],
    documentQuota: null,
    emailRateLimits: [],
    emailQuota: null,
    apiRateLimits: [],
    apiQuota: null,
  },
} as const;

export const ZStripeOrganisationCreateMetadataSchema = z.object({
  organisationName: ZOrganisationNameSchema,
  userId: z.number(),
});

export type StripeOrganisationCreateMetadata = z.infer<typeof ZStripeOrganisationCreateMetadataSchema>;
