import { z } from 'zod';

import { ZAdminRuleListItemSchema } from './get-admin-rules.types';

export const ZGetAdminRuleRequestSchema = z.object({
  ruleId: z.string(),
});

export const ZGetAdminRuleResponseSchema = ZAdminRuleListItemSchema;

export type TGetAdminRuleRequest = z.infer<typeof ZGetAdminRuleRequestSchema>;
export type TGetAdminRuleResponse = z.infer<typeof ZGetAdminRuleResponseSchema>;
