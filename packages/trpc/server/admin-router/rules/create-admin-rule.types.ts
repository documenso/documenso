import {
  ZAdminRuleDefinitionSchema,
  ZAdminRuleModeSchema,
  ZAdminRuleTriggerSchema,
} from '@documenso/lib/types/admin-rules';
import AdminRuleSchema from '@documenso/prisma/generated/zod/modelSchema/AdminRuleSchema';
import { z } from 'zod';

export const ZAdminRuleDataSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).nullable(),
  trigger: ZAdminRuleTriggerSchema,
  mode: ZAdminRuleModeSchema,
  stopOnMatch: z.boolean(),
  definition: ZAdminRuleDefinitionSchema,
  exemptOrganisationIds: z.array(z.string()).max(100).default([]),
});

export const ZCreateAdminRuleRequestSchema = ZAdminRuleDataSchema;

export const ZCreateAdminRuleResponseSchema = AdminRuleSchema;

export type TCreateAdminRuleRequest = z.infer<typeof ZCreateAdminRuleRequestSchema>;
export type TCreateAdminRuleResponse = z.infer<typeof ZCreateAdminRuleResponseSchema>;
