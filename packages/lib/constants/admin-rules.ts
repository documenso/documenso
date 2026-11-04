import { AdminRuleMode } from '@prisma/client';
import { match } from 'ts-pattern';

import {
  type TAdminRuleActionParams,
  type TAdminRuleActionType,
  type TAdminRuleContext,
  type TAdminRuleFieldType,
  type TAdminRuleOperator,
  type TAdminRuleTrigger,
  ZAdminRuleActionParamsSchema,
  ZAdminRuleActionTypeSchema,
  ZAdminRuleTriggerSchema,
} from '../types/admin-rules';
import { INTERNAL_CLAIM_ID } from '../types/subscription';
import { type TUserAuthMethod, UserAuthMethod } from '../types/user-auth-method';

/**
 * Single source of truth for the admin rules engine.
 *
 * Everything the UI builder, expression preview, tester and evaluator need to know about the
 * available triggers, fields, operators and actions is described here.
 *
 * Translations for these identifiers live in `admin-rules-translations.ts`.
 */

export const ADMIN_RULE_TRIGGERS = ZAdminRuleTriggerSchema.options;

export const ADMIN_RULE_MODES = Object.values(AdminRuleMode);

/**
 * Whether a rule on this trigger can list organisations to skip. Only triggers whose event belongs
 * to a single organisation qualify; user-level triggers do not.
 */
export const ADMIN_RULE_TRIGGER_SUPPORTS_ORGANISATION_EXEMPTIONS: Record<TAdminRuleTrigger, boolean> = {
  USER_NAME_CHANGED: false,
  USER_SIGNED_UP: false,
  DOCUMENT_SENT: true,
  EMAIL_SENT: true,
};

export const ADMIN_RULE_MAX_REGEX_LENGTH = 256;

/**
 * Structural limits for a rule definition. These are policy rather than part of the stored shape:
 * `getAdminRuleDefinitionIssues` enforces them, so raising one never invalidates stored rules.
 */
export const ADMIN_RULE_LIMITS = {
  /**
   * Levels of condition groups, counting the rule's own top-level group.
   */
  maxGroupDepth: 3,
  /**
   * Conditions across the whole rule. Also bounds how much work evaluating one event can take.
   */
  maxConditions: 20,
} as const;

/**
 * Matches older than this are pruned by the cleanup job.
 */
export const ADMIN_RULE_MATCH_RETENTION_DAYS = 90;

const REQUEST_SOURCES = ['app', 'apiV1', 'apiV2'] as const;
const ENVELOPE_SOURCES = ['app', 'api', 'template', 'direct_link'] as const;
const EMAIL_TYPES = ['signing_request', 'reminder', 'completed', 'rejected'] as const;

export type AdminRuleFieldOption =
  | (typeof REQUEST_SOURCES)[number]
  | (typeof ENVELOPE_SOURCES)[number]
  | (typeof EMAIL_TYPES)[number]
  | INTERNAL_CLAIM_ID
  | TUserAuthMethod;

export type AdminRuleField = {
  key: string;
  type: TAdminRuleFieldType;
  options?: readonly AdminRuleFieldOption[];
};

const buildUserFields = (prefix: string): AdminRuleField[] => [
  { key: `${prefix}.id`, type: 'number' },
  { key: `${prefix}.email`, type: 'string' },
  { key: `${prefix}.email_domain`, type: 'string' },
  { key: `${prefix}.name`, type: 'string' },
  { key: `${prefix}.account_age_days`, type: 'number' },
  { key: `${prefix}.two_factor_enabled`, type: 'boolean' },
];

const REQUEST_FIELDS: AdminRuleField[] = [
  { key: 'request.ip', type: 'string' },
  { key: 'request.user_agent', type: 'string' },
  { key: 'request.source', type: 'enum', options: REQUEST_SOURCES },
];

const ENVELOPE_FIELDS: AdminRuleField[] = [
  { key: 'envelope.id', type: 'string' },
  { key: 'envelope.title', type: 'string' },
  { key: 'envelope.recipient_count', type: 'number' },
  { key: 'envelope.recipient_domains', type: 'string_list' },
  { key: 'envelope.source', type: 'enum', options: ENVELOPE_SOURCES },
];

const SENDER_FIELDS: AdminRuleField[] = [
  ...buildUserFields('sender'),
  { key: 'sender.plan', type: 'enum', options: Object.values(INTERNAL_CLAIM_ID) },
  { key: 'sender.documents_sent_last_24h', type: 'number' },
  { key: 'sender.documents_sent_last_7d', type: 'number' },
];

const TEAM_FIELDS: AdminRuleField[] = [
  { key: 'team.id', type: 'number' },
  { key: 'team.url', type: 'string' },
];

export const ADMIN_RULE_TRIGGER_FIELDS: Record<TAdminRuleTrigger, AdminRuleField[]> = {
  USER_NAME_CHANGED: [
    ...buildUserFields('user').filter((field) => field.key !== 'user.name'),
    { key: 'user.old_name', type: 'string' },
    { key: 'user.new_name', type: 'string' },
    ...REQUEST_FIELDS,
  ],
  USER_SIGNED_UP: [
    { key: 'user.email', type: 'string' },
    { key: 'user.email_domain', type: 'string' },
    { key: 'user.name', type: 'string' },
    {
      key: 'user.signup_method',
      type: 'enum',
      // Passkeys can only be added to an existing account.
      options: Object.values(UserAuthMethod).filter((method) => method !== UserAuthMethod.PASSKEY),
    },
    { key: 'request.ip', type: 'string' },
    { key: 'request.user_agent', type: 'string' },
  ],
  DOCUMENT_SENT: [...SENDER_FIELDS, ...ENVELOPE_FIELDS, ...TEAM_FIELDS, ...REQUEST_FIELDS],
  EMAIL_SENT: [
    ...SENDER_FIELDS,
    { key: 'email.type', type: 'enum', options: EMAIL_TYPES },
    { key: 'email.subject', type: 'string' },
    { key: 'email.body', type: 'string' },
    { key: 'email.recipient_count', type: 'number' },
    { key: 'email.recipient_domains', type: 'string_list' },
    { key: 'email.has_custom_subject', type: 'boolean' },
    { key: 'email.has_custom_message', type: 'boolean' },
    ...ENVELOPE_FIELDS,
  ],
};

export const ADMIN_RULE_OPERATORS_BY_FIELD_TYPE: Record<TAdminRuleFieldType, TAdminRuleOperator[]> = {
  string: ['equals', 'contains', 'starts_with', 'ends_with', 'matches_regex', 'in_list', 'is_empty'],
  number: ['equals', 'greater_than', 'greater_than_or_equal', 'less_than', 'less_than_or_equal', 'between'],
  boolean: ['is_true', 'is_false'],
  enum: ['is', 'in_list'],
  string_list: ['contains', 'any_matches_regex', 'all_in_list', 'any_in_list', 'count_greater_than', 'is_empty'],
};

/**
 * Operators that do not take a value.
 */
export const ADMIN_RULE_VALUELESS_OPERATORS: TAdminRuleOperator[] = ['is_empty', 'is_true', 'is_false'];

/**
 * Operators whose value is a comma separated list.
 */
export const ADMIN_RULE_LIST_OPERATORS: TAdminRuleOperator[] = ['in_list', 'all_in_list', 'any_in_list', 'between'];

export const ADMIN_RULE_REGEX_OPERATORS: TAdminRuleOperator[] = ['matches_regex', 'any_matches_regex'];

export type AdminRuleActionParamKey = keyof TAdminRuleActionParams;

export type AdminRuleActionParamDefinition = {
  key: AdminRuleActionParamKey;
  kind: 'text' | 'number' | 'boolean' | 'select';
  options?: readonly string[];
  required?: boolean;
};

export type AdminRuleActionDefinition = {
  allowedTriggers: readonly TAdminRuleTrigger[] | 'all';
  params: AdminRuleActionParamDefinition[];
};

export const ADMIN_RULE_ACTIONS: Record<TAdminRuleActionType, AdminRuleActionDefinition> = {
  block_event: {
    // Sign-up rules run after the account is created, so there is nothing left to block.
    allowedTriggers: ADMIN_RULE_TRIGGERS.filter((trigger) => trigger !== 'USER_SIGNED_UP'),
    params: [],
  },
  flag_account_for_review: {
    allowedTriggers: 'all',
    params: [{ key: 'reason', kind: 'text', required: true }],
  },
  disable_emails: {
    // Turns off email for the document's organisation. User-level events (sign-ups, name changes)
    // belong to no single organisation, so the action is not offered on them.
    allowedTriggers: ['DOCUMENT_SENT', 'EMAIL_SENT'],
    params: [{ key: 'reason', kind: 'text' }],
  },
  disable_user: {
    allowedTriggers: 'all',
    params: [{ key: 'reason', kind: 'text' }],
  },
  log_only: {
    allowedTriggers: 'all',
    params: [{ key: 'note', kind: 'text' }],
  },
};

export const ADMIN_RULE_ACTION_TYPES = ZAdminRuleActionTypeSchema.options;

export const getAdminRuleActionsForTrigger = (trigger: TAdminRuleTrigger) =>
  ADMIN_RULE_ACTION_TYPES.filter((type) => {
    const { allowedTriggers } = ADMIN_RULE_ACTIONS[type];

    return allowedTriggers === 'all' || allowedTriggers.includes(trigger);
  });

export const getAdminRuleDefaultActionParams = (type: TAdminRuleActionType): TAdminRuleActionParams => {
  const entries = ADMIN_RULE_ACTIONS[type].params.map((param) => [
    param.key,
    match(param.kind)
      .with('boolean', () => false)
      .with('number', () => 0)
      .with('select', () => param.options?.[0] ?? '')
      .with('text', () => '')
      .exhaustive(),
  ]);

  return ZAdminRuleActionParamsSchema.parse(Object.fromEntries(entries));
};

const buildUserSampleEvent = (prefix: string): TAdminRuleContext => ({
  [`${prefix}.id`]: 42,
  [`${prefix}.email`]: 'jane@example.com',
  [`${prefix}.email_domain`]: 'example.com',
  [`${prefix}.name`]: 'Jane Doe',
  [`${prefix}.account_age_days`]: 1,
  [`${prefix}.two_factor_enabled`]: false,
});

const REQUEST_SAMPLE_EVENT: TAdminRuleContext = {
  'request.ip': '127.0.0.1',
  'request.user_agent': 'Mozilla/5.0',
  'request.source': 'app',
};

const ENVELOPE_SAMPLE_EVENT: TAdminRuleContext = {
  'envelope.id': 'env_123',
  'envelope.title': 'Invoice #1042',
  'envelope.recipient_count': 12,
  'envelope.recipient_domains': ['gmail.com', 'example.com'],
  'envelope.source': 'app',
};

const SENDER_SAMPLE_EVENT: TAdminRuleContext = {
  ...buildUserSampleEvent('sender'),
  'sender.plan': INTERNAL_CLAIM_ID.FREE,
  'sender.documents_sent_last_24h': 25,
  'sender.documents_sent_last_7d': 40,
};

const TEAM_SAMPLE_EVENT: TAdminRuleContext = {
  'team.id': 7,
  'team.url': 'acme',
};

/**
 * Sample events used to pre-fill the rule tester for each trigger.
 */
export const ADMIN_RULE_SAMPLE_EVENTS: Record<TAdminRuleTrigger, TAdminRuleContext> = {
  USER_NAME_CHANGED: {
    ...buildUserSampleEvent('user'),
    'user.old_name': 'Jane Doe',
    'user.new_name': 'Documenso Support',
    ...REQUEST_SAMPLE_EVENT,
  },
  USER_SIGNED_UP: {
    'user.email': 'jane@mailinator.com',
    'user.email_domain': 'mailinator.com',
    'user.name': 'Jane Doe',
    'user.signup_method': UserAuthMethod.PASSWORD,
    'request.ip': '127.0.0.1',
    'request.user_agent': 'Mozilla/5.0',
  },
  DOCUMENT_SENT: {
    ...SENDER_SAMPLE_EVENT,
    ...ENVELOPE_SAMPLE_EVENT,
    ...TEAM_SAMPLE_EVENT,
    ...REQUEST_SAMPLE_EVENT,
  },
  EMAIL_SENT: {
    ...SENDER_SAMPLE_EVENT,
    'email.type': 'signing_request',
    'email.subject': 'Please sign: Invoice #1042',
    'email.body': 'Hi, please sign the attached invoice at your earliest convenience.',
    'email.recipient_count': 12,
    'email.recipient_domains': ['gmail.com', 'example.com'],
    'email.has_custom_subject': true,
    'email.has_custom_message': true,
    ...ENVELOPE_SAMPLE_EVENT,
  },
};
