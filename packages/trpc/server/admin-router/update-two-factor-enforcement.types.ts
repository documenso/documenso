import { z } from 'zod';

export const ZUpdateTwoFactorEnforcementRequestSchema = z.object({
  enabled: z.boolean(),
  gracePeriodDays: z.number().int().min(0).max(365),

  acknowledgeGracePeriodReduction: z.boolean().optional(),
});

export const ZUpdateTwoFactorEnforcementResponseSchema = z.void();

export type TUpdateTwoFactorEnforcementRequest = z.infer<typeof ZUpdateTwoFactorEnforcementRequestSchema>;
export type TUpdateTwoFactorEnforcementResponse = z.infer<typeof ZUpdateTwoFactorEnforcementResponseSchema>;
