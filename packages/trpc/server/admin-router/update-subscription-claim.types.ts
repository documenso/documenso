import { z } from 'zod';

import { ZCreateSubscriptionClaimRequestSchema } from './create-subscription-claim.types';

export const ZUpdateSubscriptionClaimRequestSchema = z.object({
  id: z.string(),
  data: ZCreateSubscriptionClaimRequestSchema,
  // When enabled, the claim's email transport is propagated to all organisations
  // currently using this claim.
  backportEmailTransport: z.boolean().default(false),
});

export const ZUpdateSubscriptionClaimResponseSchema = z.void();

export type TUpdateSubscriptionClaimRequest = z.infer<typeof ZUpdateSubscriptionClaimRequestSchema>;
