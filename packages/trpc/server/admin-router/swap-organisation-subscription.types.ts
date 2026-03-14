import { z } from 'zod';

export const ZSwapOrganisationSubscriptionRequestSchema = z.object({
  sourceOrganisationId: z.string(),
  targetOrganisationId: z.string(),
});

export const ZSwapOrganisationSubscriptionResponseSchema = z.void();

export type TSwapOrganisationSubscriptionRequest = z.infer<
  typeof ZSwapOrganisationSubscriptionRequestSchema
>;
export type TSwapOrganisationSubscriptionResponse = z.infer<
  typeof ZSwapOrganisationSubscriptionResponseSchema
>;
