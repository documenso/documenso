import { z } from 'zod';

export const ZDeleteSubscriptionClaimRequestSchema = z.object({
  id: z.string().cuid(),
});

export const ZDeleteSubscriptionClaimResponseSchema = z.void();

export type TDeleteSubscriptionClaimRequest = z.infer<typeof ZDeleteSubscriptionClaimRequestSchema>;
