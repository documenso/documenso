import AdminRuleSchema from '@documenso/prisma/generated/zod/modelSchema/AdminRuleSchema';
import { z } from 'zod';

import { ZAdminRuleDataSchema } from './create-admin-rule.types';

export const ZUpdateAdminRuleRequestSchema = z.object({
  ruleId: z.string(),
  data: ZAdminRuleDataSchema.partial(),
});

export const ZUpdateAdminRuleResponseSchema = AdminRuleSchema;

export type TUpdateAdminRuleRequest = z.infer<typeof ZUpdateAdminRuleRequestSchema>;
export type TUpdateAdminRuleResponse = z.infer<typeof ZUpdateAdminRuleResponseSchema>;
