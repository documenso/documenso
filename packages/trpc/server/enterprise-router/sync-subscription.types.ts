import { z } from 'zod';

export const ZSyncSubscriptionRequestSchema = z.object({
  organisationId: z.string().describe('The organisation to sync the subscription for'),
});

export const ZSyncSubscriptionResponseSchema = z.void();

export type TSyncSubscriptionRequest = z.infer<typeof ZSyncSubscriptionRequestSchema>;
export type TSyncSubscriptionResponse = z.infer<typeof ZSyncSubscriptionResponseSchema>;
