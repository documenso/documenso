import { AdminRuleMode } from '@prisma/client';
import { z } from 'zod';

/**
 * Admin rules: site-admin defined if / then automations evaluated against platform events.
 *
 * These schemas describe the shape of a rule definition stored as JSON. The registry of
 * available triggers, fields, operators and actions lives in `constants/admin-rules.ts`.
 */

export const ZAdminRuleTriggerSchema = z.enum(['USER_NAME_CHANGED', 'USER_SIGNED_UP', 'DOCUMENT_SENT', 'EMAIL_SENT']);

export type TAdminRuleTrigger = z.infer<typeof ZAdminRuleTriggerSchema>;

export const ZAdminRuleModeSchema = z.nativeEnum(AdminRuleMode);

export type TAdminRuleMode = z.infer<typeof ZAdminRuleModeSchema>;

export const ZAdminRuleFieldTypeSchema = z.enum(['string', 'number', 'boolean', 'enum', 'string_list']);

export type TAdminRuleFieldType = z.infer<typeof ZAdminRuleFieldTypeSchema>;

export const ZAdminRuleOperatorSchema = z.enum([
  // string
  'equals',
  'contains',
  'starts_with',
  'ends_with',
  'matches_regex',
  'in_list',
  'is_empty',
  // number
  'greater_than',
  'greater_than_or_equal',
  'less_than',
  'less_than_or_equal',
  'between',
  // boolean
  'is_true',
  'is_false',
  // enum
  'is',
  // string_list
  'any_matches_regex',
  'all_in_list',
  'any_in_list',
  'count_greater_than',
]);

export type TAdminRuleOperator = z.infer<typeof ZAdminRuleOperatorSchema>;

/**
 * How the children of a condition group combine: `all` is AND, `any` is OR.
 */
export const ZAdminRuleGroupMatchSchema = z.enum(['all', 'any']);

export type TAdminRuleGroupMatch = z.infer<typeof ZAdminRuleGroupMatchSchema>;

export const ZAdminRuleActionTypeSchema = z.enum([
  'block_event',
  'flag_account_for_review',
  'disable_emails',
  'disable_user',
  'log_only',
]);

export type TAdminRuleActionType = z.infer<typeof ZAdminRuleActionTypeSchema>;

/**
 * A single test against one event field. Values are always stored as strings and parsed at
 * evaluation time based on the operator (comma separated for lists and `between`, numeric for
 * number operators).
 */
export const ZAdminRuleConditionSchema = z.object({
  type: z.literal('condition'),
  field: z.string().min(1),
  operator: ZAdminRuleOperatorSchema,
  value: z.string(),
});

export type TAdminRuleCondition = z.infer<typeof ZAdminRuleConditionSchema>;

/**
 * Conditions and nested groups joined with AND (`all`) or OR (`any`). How deep groups may nest is
 * a policy limit (`ADMIN_RULE_LIMITS`) rather than part of the stored shape.
 */
export type TAdminRuleConditionGroup = {
  type: 'group';
  match: TAdminRuleGroupMatch;
  children: TAdminRuleConditionNode[];
};

export type TAdminRuleConditionNode = TAdminRuleCondition | TAdminRuleConditionGroup;

export const ZAdminRuleConditionGroupSchema: z.ZodType<TAdminRuleConditionGroup> = z.lazy(() =>
  z.object({
    type: z.literal('group'),
    match: ZAdminRuleGroupMatchSchema,
    children: z.array(z.union([ZAdminRuleConditionSchema, ZAdminRuleConditionGroupSchema])).min(1),
  }),
);

/**
 * Action parameters are stored as a single optional bag. The registry describes which keys each
 * action type uses so forms and evaluators can stay generic.
 */
export const ZAdminRuleActionParamsSchema = z.object({
  reason: z.string().optional(),
  note: z.string().optional(),
});

export type TAdminRuleActionParams = z.infer<typeof ZAdminRuleActionParamsSchema>;

export const ZAdminRuleActionSchema = z.object({
  type: ZAdminRuleActionTypeSchema,
  params: ZAdminRuleActionParamsSchema,
});

export type TAdminRuleAction = z.infer<typeof ZAdminRuleActionSchema>;

/**
 * A rule's logic: when the condition group holds for an event, the actions run.
 */
export const ZAdminRuleDefinitionSchema = z.object({
  when: ZAdminRuleConditionGroupSchema,
  actions: z.array(ZAdminRuleActionSchema).min(1),
});

export type TAdminRuleDefinition = z.infer<typeof ZAdminRuleDefinitionSchema>;

export const ZAdminRuleContextValueSchema = z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]);

export type TAdminRuleContextValue = z.infer<typeof ZAdminRuleContextValueSchema>;

/**
 * The flat event object a rule is evaluated against, keyed by field key (e.g. `user.new_name`).
 */
export const ZAdminRuleContextSchema = z.record(z.string(), ZAdminRuleContextValueSchema);

export type TAdminRuleContext = z.infer<typeof ZAdminRuleContextSchema>;

export const ZAdminRuleActionRunStatusSchema = z.enum(['ran', 'would_run', 'failed', 'skipped']);

export type TAdminRuleActionRunStatus = z.infer<typeof ZAdminRuleActionRunStatusSchema>;

export const ZAdminRuleActionRunSchema = z.object({
  type: ZAdminRuleActionTypeSchema,
  status: ZAdminRuleActionRunStatusSchema,
  error: z.string().optional(),
});

export type TAdminRuleActionRun = z.infer<typeof ZAdminRuleActionRunSchema>;

export const ZAdminRuleActionRunsSchema = z.array(ZAdminRuleActionRunSchema);

export type TAdminRuleActionRuns = z.infer<typeof ZAdminRuleActionRunsSchema>;
