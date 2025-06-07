import { z } from 'zod';

import { ZClaimFlagsSchema } from '@documenso/lib/types/subscription';

export const ZCreateSubscriptionClaimRequestSchema = z.object({
  name: z.string().min(1),
  teamCount: z.number().int().min(0),
  memberCount: z.number().int().min(0),
  flags: ZClaimFlagsSchema,
});

export const ZCreateSubscriptionClaimResponseSchema = z.void();

export type TCreateSubscriptionClaimRequest = z.infer<typeof ZCreateSubscriptionClaimRequestSchema>;
