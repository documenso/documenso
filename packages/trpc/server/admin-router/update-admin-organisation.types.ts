import { ZNameSchema } from '@documenso/lib/types/name';
import { z } from 'zod';

import { ZTeamUrlSchema } from '../team-router/schema';
import { ZCreateSubscriptionClaimRequestSchema } from './create-subscription-claim.types';

export const ZUpdateAdminOrganisationRequestSchema = z.object({
  organisationId: z.string(),
  data: z.object({
    name: ZNameSchema.optional(),
    url: ZTeamUrlSchema.optional(),
    claims: ZCreateSubscriptionClaimRequestSchema.pick({
      teamCount: true,
      memberCount: true,
      envelopeItemCount: true,
      recipientCount: true,
      flags: true,
      documentRateLimits: true,
      documentQuota: true,
      emailRateLimits: true,
      emailQuota: true,
      apiRateLimits: true,
      apiQuota: true,
      emailTransportId: true,
    }).optional(),
    customerId: z.string().optional(),
    originalSubscriptionClaimId: z.string().optional(),
  }),
});

export const ZUpdateAdminOrganisationResponseSchema = z.void();

export type TUpdateAdminOrganisationRequest = z.infer<typeof ZUpdateAdminOrganisationRequestSchema>;
