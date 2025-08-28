import { z } from 'zod';

import OrganisationClaimSchema from '@documenso/prisma/generated/zod/modelSchema/OrganisationClaimSchema';
import { OrganisationSchema } from '@documenso/prisma/generated/zod/modelSchema/OrganisationSchema';

export const ZOrganisationSchema = OrganisationSchema.pick({
  id: true,
  createdAt: true,
  updatedAt: true,
  type: true,
  name: true,
  url: true,
  avatarImageId: true,
  customerId: true,
  ownerUserId: true,
}).extend({
  organisationClaim: OrganisationClaimSchema.pick({
    id: true,
    createdAt: true,
    updatedAt: true,
    originalSubscriptionClaimId: true,
    teamCount: true,
    memberCount: true,
    flags: true,
  }),
});

export type TOrganisation = z.infer<typeof ZOrganisationSchema>;

export const ZOrganisationLiteSchema = OrganisationSchema.pick({
  id: true,
  createdAt: true,
  updatedAt: true,
  type: true,
  name: true,
  url: true,
  avatarImageId: true,
  customerId: true,
  ownerUserId: true,
});

/**
 * A version of the organisation response schema when returning multiple organisations at once from a single API endpoint.
 */
export const ZOrganisationManySchema = ZOrganisationLiteSchema;

export const ZOrganisationAccountLinkMetadataSchema = z.object({
  type: z.enum(['link', 'create']),
  userId: z.number(),
  organisationId: z.string(),
  oauthConfig: z.object({
    providerAccountId: z.string(),
    accessToken: z.string(),
    expiresAt: z.number(),
    idToken: z.string(),
  }),
});

export type TOrganisationAccountLinkMetadata = z.infer<
  typeof ZOrganisationAccountLinkMetadataSchema
>;
