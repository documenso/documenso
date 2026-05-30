import { ZClaimFlagsSchema, ZRateLimitArraySchema } from '@documenso/lib/types/subscription';
import { z } from 'zod';

export const ZCreateSubscriptionClaimRequestSchema = z.object({
  name: z.string().min(1),
  teamCount: z.number().int().min(0),
  memberCount: z.number().int().min(0),
  envelopeItemCount: z.number().int().min(1),
  recipientCount: z.number().int().min(0),
  flags: ZClaimFlagsSchema,

  documentRateLimits: ZRateLimitArraySchema,
  documentQuota: z.number().int().min(0).nullable(),

  emailRateLimits: ZRateLimitArraySchema,
  emailQuota: z.number().int().min(0).nullable(),

  apiRateLimits: ZRateLimitArraySchema,
  apiQuota: z.number().int().min(0).nullable(),
});

export const ZCreateSubscriptionClaimResponseSchema = z.void();

export type TCreateSubscriptionClaimRequest = z.infer<typeof ZCreateSubscriptionClaimRequestSchema>;
