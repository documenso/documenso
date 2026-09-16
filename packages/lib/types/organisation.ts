import OrganisationClaimSchema from '@documenso/prisma/generated/zod/modelSchema/OrganisationClaimSchema';
import { OrganisationSchema } from '@documenso/prisma/generated/zod/modelSchema/OrganisationSchema';
import { z } from 'zod';

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
    recipientCount: true,
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

/**
 * Metadata stored on the SSO account-link verification token.
 *
 * Intentionally stores ONLY the provider subject and the email address the
 * confirmation was sent to — never access/ID tokens. The linked account row
 * is created without provider tokens; the organisation portal re-authenticates
 * against the IdP on every sign-in, so persisting tokens in a verification
 * token row would only widen the blast radius of a database leak.
 */
export const ZOrganisationAccountLinkMetadataSchema = z.object({
  type: z.enum(['link', 'create']),
  userId: z.number(),
  organisationId: z.string(),

  /**
   * The email address the confirmation email was sent to. Confirmation
   * asserts the user's email still matches this value.
   */
  email: z.string().email(),
  oauthConfig: z.object({
    providerAccountId: z.string(),
  }),
});

export type TOrganisationAccountLinkMetadata = z.infer<typeof ZOrganisationAccountLinkMetadataSchema>;
