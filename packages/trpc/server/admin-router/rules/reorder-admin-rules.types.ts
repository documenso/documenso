import { z } from 'zod';

export const ZReorderAdminRulesRequestSchema = z.object({
  ruleIds: z.array(z.string()).min(1),
});

export const ZReorderAdminRulesResponseSchema = z.void();

export type TReorderAdminRulesRequest = z.infer<typeof ZReorderAdminRulesRequestSchema>;
export type TReorderAdminRulesResponse = z.infer<typeof ZReorderAdminRulesResponseSchema>;
