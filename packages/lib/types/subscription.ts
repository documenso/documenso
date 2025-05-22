import type { MessageDescriptor } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import type { SubscriptionClaim } from '@prisma/client';
import { z } from 'zod';

import { ZOrganisationNameSchema } from '@documenso/trpc/server/organisation-router/create-organisation.types';

export const ZClaimFlagsSchema = z.object({
  unlimitedDocuments: z.boolean().optional(),

  /**
   * Allows disabling of Documenso branding for:
   * - Certificates
   * - Emails
   * - Todo: orgs
   *
   * Todo: orgs - Rename to allowCustomBranding
   */
  branding: z.boolean().optional(),
  hidePoweredBy: z.boolean().optional(),

  embedAuthoring: z.boolean().optional(),
  embedAuthoringWhiteLabel: z.boolean().optional(),

  embedSigning: z.boolean().optional(),
  embedSigningWhiteLabel: z.boolean().optional(),

  cfr21: z.boolean().optional(),
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
  branding: {
    key: 'branding',
    label: 'Branding',
  },
  hidePoweredBy: {
    key: 'hidePoweredBy',
    label: 'Hide Documenso branding by',
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
};

export enum INTERNAL_CLAIM_ID {
  FREE = 'free',
  INDIVIDUAL = 'individual',
  PRO = 'pro',
  EARLY_ADOPTER = 'earlyAdopter',
  PLATFORM = 'platform',
  ENTERPRISE = 'enterprise',
}

export type InternalClaim = Omit<SubscriptionClaim, 'createdAt' | 'updatedAt'> & {
  description: MessageDescriptor | string;
};

export type InternalClaims = {
  [key in INTERNAL_CLAIM_ID]: InternalClaim;
};

export const internalClaims: InternalClaims = {
  [INTERNAL_CLAIM_ID.FREE]: {
    id: INTERNAL_CLAIM_ID.FREE,
    name: 'Free',
    description: msg`5 Documents a month`,
    teamCount: 1,
    memberCount: 1,
    locked: true,
    flags: {},
  },
  [INTERNAL_CLAIM_ID.INDIVIDUAL]: {
    id: INTERNAL_CLAIM_ID.INDIVIDUAL,
    name: 'Individual',
    description: msg`Unlimited documents, API and more`,
    teamCount: 1,
    memberCount: 1,
    locked: true,
    flags: {
      unlimitedDocuments: true,
    },
  },
  [INTERNAL_CLAIM_ID.PRO]: {
    id: INTERNAL_CLAIM_ID.PRO, // Team -> Pro
    name: 'Teams',
    description: msg`Embedding, 5 members included and more`,
    teamCount: 1,
    memberCount: 5,
    locked: true,
    flags: {
      unlimitedDocuments: true,
      branding: true,
      embedSigning: true, // Pro (team) plan only gets embedSigning right?
    },
  },
  [INTERNAL_CLAIM_ID.PLATFORM]: {
    id: INTERNAL_CLAIM_ID.PLATFORM,
    name: 'Platform',
    description: msg`Whitelabeling, unlimited members and more`,
    teamCount: 1,
    memberCount: 0,
    locked: true,
    flags: {
      unlimitedDocuments: true,
      branding: true,
      hidePoweredBy: true,
      embedAuthoring: false,
      embedAuthoringWhiteLabel: true,
      embedSigning: false,
      embedSigningWhiteLabel: true,
    },
  },
  [INTERNAL_CLAIM_ID.ENTERPRISE]: {
    id: INTERNAL_CLAIM_ID.ENTERPRISE,
    name: 'Enterprise',
    description: '',
    teamCount: 0,
    memberCount: 0,
    locked: true,
    flags: {
      unlimitedDocuments: true,
      branding: true,
      hidePoweredBy: true,
      embedAuthoring: true,
      embedAuthoringWhiteLabel: true,
      embedSigning: true,
      embedSigningWhiteLabel: true,
      cfr21: true,
    },
  },
  [INTERNAL_CLAIM_ID.EARLY_ADOPTER]: {
    id: INTERNAL_CLAIM_ID.EARLY_ADOPTER,
    name: 'Early Adopter',
    description: '',
    teamCount: 0,
    memberCount: 0,
    locked: true,
    flags: {
      unlimitedDocuments: true,
      branding: true,
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
