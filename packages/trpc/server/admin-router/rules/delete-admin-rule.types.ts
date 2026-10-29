import { z } from 'zod';

export const ZDeleteAdminRuleRequestSchema = z.object({
  ruleId: z.string(),
});

export const ZDeleteAdminRuleResponseSchema = z.void();

export type TDeleteAdminRuleRequest = z.infer<typeof ZDeleteAdminRuleRequestSchema>;
export type TDeleteAdminRuleResponse = z.infer<typeof ZDeleteAdminRuleResponseSchema>;
