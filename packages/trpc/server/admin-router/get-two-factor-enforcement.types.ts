import { z } from 'zod';

export const ZGetTwoFactorEnforcementRequestSchema = z.void();

export const ZGetTwoFactorEnforcementResponseSchema = z.object({
  enabled: z.boolean(),
  gracePeriodDays: z.number().int().min(0).max(365),
  enforcedFrom: z.string().datetime().nullable(),
  isLicensed: z.boolean(),
  isActive: z.boolean(),
});

export type TGetTwoFactorEnforcementRequest = z.infer<typeof ZGetTwoFactorEnforcementRequestSchema>;
export type TGetTwoFactorEnforcementResponse = z.infer<typeof ZGetTwoFactorEnforcementResponseSchema>;
