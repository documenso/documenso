import { z } from 'zod';

import { ZCreateSubscriptionClaimRequestSchema } from './create-subscription-claim.types';

export const ZUpdateSubscriptionClaimRequestSchema = z.object({
  id: z.string(),
  data: ZCreateSubscriptionClaimRequestSchema,
});

export const ZUpdateSubscriptionClaimResponseSchema = z.void();

export type TUpdateSubscriptionClaimRequest = z.infer<typeof ZUpdateSubscriptionClaimRequestSchema>;
