import { z } from 'zod';

export const ZSyncOrganisationSubscriptionRequestSchema = z.object({
  organisationId: z.string(),
  syncClaims: z.boolean(),
});

export const ZSyncOrganisationSubscriptionResponseSchema = z.void();

export type TSyncOrganisationSubscriptionRequest = z.infer<typeof ZSyncOrganisationSubscriptionRequestSchema>;
export type TSyncOrganisationSubscriptionResponse = z.infer<typeof ZSyncOrganisationSubscriptionResponseSchema>;
