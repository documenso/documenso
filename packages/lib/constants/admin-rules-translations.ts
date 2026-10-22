/**
 * These constants are in a different file to avoid E2E tests from importing `msg`
 * which will break it.
 */
import type { MessageDescriptor } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import type {
  TAdminRuleActionRunStatus,
  TAdminRuleActionType,
  TAdminRuleGroupMatch,
  TAdminRuleMode,
  TAdminRuleOperator,
  TAdminRuleTrigger,
} from '../types/admin-rules';
import type { AdminRuleDefinitionIssueCode } from '../utils/admin-rules';
import type { AdminRuleActionParamKey } from './admin-rules';

export const ADMIN_RULE_TRIGGER_MAP: Record<TAdminRuleTrigger, MessageDescriptor> = {
  USER_NAME_CHANGED: msg`User changes their name`,
  USER_SIGNED_UP: msg`User signs up`,
  DOCUMENT_SENT: msg`Document is sent`,
  EMAIL_SENT: msg`Email is sent`,
};

export const ADMIN_RULE_TRIGGER_DESCRIPTION_MAP: Record<TAdminRuleTrigger, MessageDescriptor> = {
  USER_NAME_CHANGED: msg`Runs when any user updates their profile name.`,
  USER_SIGNED_UP: msg`Runs after a new account is created through email, OAuth or SSO sign-up.`,
  DOCUMENT_SENT: msg`Runs before a document is distributed to its recipients.`,
  EMAIL_SENT: msg`Runs before a signing request, reminder, completion or rejection email is sent.`,
};

export const ADMIN_RULE_MODE_MAP: Record<TAdminRuleMode, MessageDescriptor> = {
  ENFORCE: msg`Enforce`,
  MONITOR: msg`Monitor`,
  DISABLED: msg`Disabled`,
};

export const ADMIN_RULE_MODE_DESCRIPTION_MAP: Record<TAdminRuleMode, MessageDescriptor> = {
  ENFORCE: msg`Conditions are evaluated and actions run.`,
  MONITOR: msg`Conditions are evaluated and logged but no actions run. Useful for tuning a rule.`,
  DISABLED: msg`The rule is stored but never evaluated.`,
};

/**
 * The word joining the conditions of a group, shown between rows in the condition builder.
 */
export const ADMIN_RULE_GROUP_MATCH_MAP: Record<TAdminRuleGroupMatch, MessageDescriptor> = {
  all: msg`and`,
  any: msg`or`,
};

export const ADMIN_RULE_OPERATOR_MAP: Record<TAdminRuleOperator, MessageDescriptor> = {
  equals: msg`equals`,
  contains: msg`contains`,
  starts_with: msg`starts with`,
  ends_with: msg`ends with`,
  matches_regex: msg`matches regex`,
  in_list: msg`is in list`,
  is_empty: msg`is empty`,
  greater_than: msg`is greater than`,
  greater_than_or_equal: msg`is greater than or equal to`,
  less_than: msg`is less than`,
  less_than_or_equal: msg`is less than or equal to`,
  between: msg`is between`,
  is_true: msg`is true`,
  is_false: msg`is false`,
  is: msg`is`,
  any_matches_regex: msg`any matches regex`,
  all_in_list: msg`all are in list`,
  any_in_list: msg`any is in list`,
  count_greater_than: msg`count is greater than`,
};

export const ADMIN_RULE_ACTION_MAP: Record<TAdminRuleActionType, MessageDescriptor> = {
  block_event: msg`Block the event`,
  flag_account_for_review: msg`Flag account for review`,
  disable_emails: msg`Disable organisation emails`,
  disable_user: msg`Disable user`,
  log_only: msg`Log only`,
};

export const ADMIN_RULE_ACTION_DESCRIPTION_MAP: Record<TAdminRuleActionType, MessageDescriptor> = {
  block_event: msg`Stops the event: the name change is not saved, or the document or email is not sent.`,
  flag_account_for_review: msg`Marks the user's account for manual review by an administrator.`,
  disable_emails: msg`Turns on the "disable emails" claim flag for the document's organisation, so it sends no signing or notification emails.`,
  disable_user: msg`Disables the user's account, so they can't sign in until an administrator re-enables them.`,
  log_only: msg`Records the match without taking any other action.`,
};

export const ADMIN_RULE_ACTION_PARAM_MAP: Record<AdminRuleActionParamKey, MessageDescriptor> = {
  reason: msg`Reason`,
  note: msg`Note`,
};

export const ADMIN_RULE_DEFINITION_ISSUE_MAP: Record<AdminRuleDefinitionIssueCode, MessageDescriptor> = {
  FIELD_INVALID: msg`Select a field`,
  OPERATOR_INVALID: msg`Operator is not valid for this field`,
  VALUE_REQUIRED: msg`Value is required`,
  VALUE_NOT_A_NUMBER: msg`Enter a number`,
  VALUE_NOT_A_RANGE: msg`Enter two numbers, smallest first`,
  REGEX_INVALID: msg`Invalid regex`,
  ACTION_UNAVAILABLE: msg`Action is not available for this trigger`,
  PARAM_REQUIRED: msg`This field is required`,
  GROUP_TOO_DEEP: msg`Condition groups are nested too deeply`,
  TOO_MANY_CONDITIONS: msg`This rule has too many conditions`,
};

export const ADMIN_RULE_ACTION_RUN_STATUS_MAP: Record<TAdminRuleActionRunStatus, MessageDescriptor> = {
  ran: msg`ran`,
  would_run: msg`would run`,
  failed: msg`failed`,
  skipped: msg`skipped`,
};
