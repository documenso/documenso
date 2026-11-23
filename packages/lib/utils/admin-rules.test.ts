import { describe, expect, it } from 'vitest';

import { ADMIN_RULE_LIMITS, ADMIN_RULE_MAX_REGEX_LENGTH } from '../constants/admin-rules';
import type {
  TAdminRuleAction,
  TAdminRuleCondition,
  TAdminRuleConditionGroup,
  TAdminRuleConditionNode,
  TAdminRuleContext,
  TAdminRuleContextValue,
  TAdminRuleDefinition,
  TAdminRuleOperator,
  TAdminRuleTrigger,
} from '../types/admin-rules';
import {
  type AdminRuleDefinitionIssue,
  type AdminRuleDefinitionIssueCode,
  evaluateAdminRuleCondition,
  evaluateAdminRuleConditionGroup,
  evaluateAdminRuleWithLoaders,
  getAdminRuleDefinitionIssues,
} from './admin-rules';

const condition = (field: string, operator: TAdminRuleCondition['operator'], value = ''): TAdminRuleCondition => ({
  type: 'condition',
  field,
  operator,
  value,
});

const all = (...children: TAdminRuleConditionNode[]): TAdminRuleConditionGroup => ({
  type: 'group',
  match: 'all',
  children,
});

const any = (...children: TAdminRuleConditionNode[]): TAdminRuleConditionGroup => ({
  type: 'group',
  match: 'any',
  children,
});

const block: TAdminRuleAction = { type: 'block_event', params: {} };
const flag: TAdminRuleAction = { type: 'flag_account_for_review', params: { reason: 'Review' } };
const disableEmails: TAdminRuleAction = { type: 'disable_emails', params: {} };

const definition = (when: TAdminRuleConditionGroup, actions = [block]): TAdminRuleDefinition => ({
  when,
  actions,
});

describe('evaluateAdminRuleConditionGroup', () => {
  // sender.plan is free AND (envelope.recipient_count > 20 OR sender.email_domain is mailinator.com)
  const group = all(
    condition('sender.plan', 'is', 'free'),
    any(
      condition('envelope.recipient_count', 'greater_than', '20'),
      condition('sender.email_domain', 'equals', 'mailinator.com'),
    ),
  );

  it('evaluates nested groups like a boolean expression', () => {
    expect(
      evaluateAdminRuleConditionGroup(group, {
        'sender.plan': 'free',
        'envelope.recipient_count': 30,
        'sender.email_domain': 'acme.com',
      }),
    ).toBe(true);

    expect(
      evaluateAdminRuleConditionGroup(group, {
        'sender.plan': 'free',
        'envelope.recipient_count': 2,
        'sender.email_domain': 'mailinator.com',
      }),
    ).toBe(true);

    expect(
      evaluateAdminRuleConditionGroup(group, {
        'sender.plan': 'free',
        'envelope.recipient_count': 2,
        'sender.email_domain': 'acme.com',
      }),
    ).toBe(false);

    expect(
      evaluateAdminRuleConditionGroup(group, {
        'sender.plan': 'team',
        'envelope.recipient_count': 30,
        'sender.email_domain': 'mailinator.com',
      }),
    ).toBe(false);
  });
});

describe('evaluateAdminRuleCondition', () => {
  const matches = (operator: TAdminRuleOperator, value: string, eventValue: TAdminRuleContextValue) =>
    evaluateAdminRuleCondition(condition('field', operator, value), { field: eventValue });

  it('string operators ignore case and surrounding whitespace', () => {
    expect(matches('equals', 'Jane Doe', 'jane doe')).toBe(true);
    expect(matches('equals', 'admin', '  Admin ')).toBe(true);
    expect(matches('starts_with', 'invoice', ' Invoice #1042')).toBe(true);
    expect(matches('in_list', 'gmail.com, yahoo.com', 'Yahoo.com')).toBe(true);
    expect(matches('is', ' Free ', 'FREE')).toBe(true);
  });

  it('equals needs the whole value, and compares numbers as numbers', () => {
    expect(matches('equals', 'Jane', 'Jane Doe')).toBe(false);
    expect(matches('equals', '42', 42)).toBe(true);
    expect(matches('equals', '42', 43)).toBe(false);
  });

  it('contains, starts_with and ends_with match part of a string', () => {
    expect(matches('contains', 'invoice', 'Your Invoice #1042')).toBe(true);
    expect(matches('contains', 'contract', 'Invoice #1042')).toBe(false);
    expect(matches('starts_with', '#1042', 'Invoice #1042')).toBe(false);
    expect(matches('ends_with', '#1042', 'Invoice #1042')).toBe(true);
    expect(matches('ends_with', 'invoice', 'Invoice #1042')).toBe(false);
  });

  it('contains on a list matches a whole item, not a substring', () => {
    expect(matches('contains', 'GMAIL.COM', ['gmail.com', 'example.com'])).toBe(true);
    expect(matches('contains', 'gmail', ['gmail.com'])).toBe(false);
  });

  it('matches_regex tests the pattern against the value', () => {
    expect(matches('matches_regex', '^(admin|support)', 'Support team')).toBe(true);
    expect(matches('matches_regex', '^(admin|support)', 'Jane Doe')).toBe(false);
  });

  it('in_list matches only a value that is one of the listed items', () => {
    expect(matches('in_list', 'gmail.com, yahoo.com', 'example.com')).toBe(false);
  });

  it('is_empty matches blank strings and empty lists', () => {
    expect(matches('is_empty', '', '  ')).toBe(true);
    expect(matches('is_empty', '', [])).toBe(true);
    expect(matches('is_empty', '', 'Jane')).toBe(false);
    expect(matches('is_empty', '', ['gmail.com'])).toBe(false);
  });

  it('number operators compare the value against the number in the condition', () => {
    expect(matches('greater_than', '10', 11)).toBe(true);
    expect(matches('greater_than', '10', 10)).toBe(false);
    expect(matches('greater_than_or_equal', '10', 10)).toBe(true);
    expect(matches('greater_than_or_equal', '10', 9)).toBe(false);
    expect(matches('less_than', '10', 9)).toBe(true);
    expect(matches('less_than', '10', 10)).toBe(false);
    expect(matches('less_than_or_equal', '10', 10)).toBe(true);
    expect(matches('less_than_or_equal', '10', 11)).toBe(false);
  });

  it('number operators never match a value that is not a number', () => {
    expect(matches('greater_than', '10', 'not a number')).toBe(false);
  });

  it('between includes both bounds and needs exactly two numbers', () => {
    expect(matches('between', '5, 10', 5)).toBe(true);
    expect(matches('between', '5, 10', 10)).toBe(true);
    expect(matches('between', '5, 10', 11)).toBe(false);
    expect(matches('between', '5', 5)).toBe(false);
  });

  it('is_true and is_false match the boolean value', () => {
    expect(matches('is_true', '', true)).toBe(true);
    expect(matches('is_true', '', false)).toBe(false);
    expect(matches('is_false', '', false)).toBe(true);
    expect(matches('is_false', '', true)).toBe(false);
  });

  it('is matches only the same enum value', () => {
    expect(matches('is', 'free', 'team')).toBe(false);
  });

  it('any_matches_regex matches when at least one item matches the pattern', () => {
    expect(matches('any_matches_regex', '^gmail\\.', ['example.com', 'gmail.com'])).toBe(true);
    expect(matches('any_matches_regex', '^gmail\\.', ['example.com'])).toBe(false);
  });

  it('all_in_list matches only when every item is in the list', () => {
    expect(matches('all_in_list', 'gmail.com, example.com', ['gmail.com', 'example.com'])).toBe(true);
    expect(matches('all_in_list', 'gmail.com', ['gmail.com', 'example.com'])).toBe(false);
  });

  it('an empty list never matches all_in_list', () => {
    expect(matches('all_in_list', 'gmail.com', [])).toBe(false);
  });

  it('any_in_list matches when at least one item is in the list', () => {
    expect(matches('any_in_list', 'gmail.com, yahoo.com', ['example.com', 'gmail.com'])).toBe(true);
    expect(matches('any_in_list', 'gmail.com, yahoo.com', ['example.com'])).toBe(false);
  });

  it('count_greater_than compares the number of items', () => {
    expect(matches('count_greater_than', '1', ['gmail.com', 'example.com'])).toBe(true);
    expect(matches('count_greater_than', '2', ['gmail.com', 'example.com'])).toBe(false);
  });

  it('never matches an invalid regex, or one over the length limit', () => {
    const longestPattern = 'a'.repeat(ADMIN_RULE_MAX_REGEX_LENGTH);
    const tooLongPattern = 'a'.repeat(ADMIN_RULE_MAX_REGEX_LENGTH + 1);

    const event = { title: tooLongPattern, domains: ['gmail.com'] };

    expect(evaluateAdminRuleCondition(condition('title', 'matches_regex', '(unclosed'), event)).toBe(false);
    expect(evaluateAdminRuleCondition(condition('domains', 'any_matches_regex', '(unclosed'), event)).toBe(false);

    expect(evaluateAdminRuleCondition(condition('title', 'matches_regex', longestPattern), event)).toBe(true);
    expect(evaluateAdminRuleCondition(condition('title', 'matches_regex', tooLongPattern), event)).toBe(false);
  });
});

describe('getAdminRuleDefinitionIssues', () => {
  // A valid condition for each trigger used below.
  const conditionByTrigger = {
    DOCUMENT_SENT: condition('envelope.title', 'contains', 'x'),
    USER_NAME_CHANGED: condition('user.new_name', 'contains', 'x'),
    USER_SIGNED_UP: condition('user.email_domain', 'equals', 'example.com'),
  } satisfies Partial<Record<TAdminRuleTrigger, TAdminRuleCondition>>;

  const getNestedConditionIssues = (nestedCondition: TAdminRuleCondition) =>
    getAdminRuleDefinitionIssues(
      'DOCUMENT_SENT',
      definition(all(condition('sender.plan', 'is', 'free'), any(nestedCondition))),
    );

  const nestedConditionIssue = (key: string, code: AdminRuleDefinitionIssueCode): AdminRuleDefinitionIssue => ({
    path: ['when', 'children', 1, 'children', 0, key],
    code,
  });

  const getActionIssues = (trigger: keyof typeof conditionByTrigger, action: TAdminRuleAction) =>
    getAdminRuleDefinitionIssues(trigger, definition(all(conditionByTrigger[trigger]), [action]));

  const actionTypeUnavailable: AdminRuleDefinitionIssue = { path: ['actions', 0, 'type'], code: 'ACTION_UNAVAILABLE' };

  it('accepts valueless operators, decimal numbers and a range with equal bounds', () => {
    expect(getNestedConditionIssues(condition('envelope.title', 'is_empty'))).toEqual([]);
    expect(getNestedConditionIssues(condition('envelope.recipient_count', 'greater_than', '2.5'))).toEqual([]);
    expect(getNestedConditionIssues(condition('envelope.recipient_count', 'between', '5, 5'))).toEqual([]);
  });

  it('reports a field the trigger does not provide', () => {
    expect(getNestedConditionIssues(condition('user.new_name', 'contains', 'x'))).toEqual([
      nestedConditionIssue('field', 'FIELD_INVALID'),
    ]);
  });

  it('reports an operator that does not suit the field type', () => {
    expect(getNestedConditionIssues(condition('envelope.title', 'greater_than', '5'))).toEqual([
      nestedConditionIssue('operator', 'OPERATOR_INVALID'),
    ]);
  });

  it('reports a blank value', () => {
    expect(getNestedConditionIssues(condition('envelope.title', 'contains', ' '))).toEqual([
      nestedConditionIssue('value', 'VALUE_REQUIRED'),
    ]);
  });

  it('reports a value that is not a number on number fields and count_greater_than', () => {
    expect(getNestedConditionIssues(condition('envelope.recipient_count', 'greater_than', 'abc'))).toEqual([
      nestedConditionIssue('value', 'VALUE_NOT_A_NUMBER'),
    ]);
    expect(getNestedConditionIssues(condition('envelope.recipient_domains', 'count_greater_than', 'x'))).toEqual([
      nestedConditionIssue('value', 'VALUE_NOT_A_NUMBER'),
    ]);
  });

  it('reports a between value that is not two ascending numbers', () => {
    expect(getNestedConditionIssues(condition('envelope.recipient_count', 'between', '5'))).toEqual([
      nestedConditionIssue('value', 'VALUE_NOT_A_RANGE'),
    ]);
    expect(getNestedConditionIssues(condition('envelope.recipient_count', 'between', '10, 5'))).toEqual([
      nestedConditionIssue('value', 'VALUE_NOT_A_RANGE'),
    ]);
    expect(getNestedConditionIssues(condition('envelope.recipient_count', 'between', '1, x'))).toEqual([
      nestedConditionIssue('value', 'VALUE_NOT_A_RANGE'),
    ]);
    expect(getNestedConditionIssues(condition('envelope.recipient_count', 'between', '1, 2, 3'))).toEqual([
      nestedConditionIssue('value', 'VALUE_NOT_A_RANGE'),
    ]);
  });

  it('reports an invalid regex', () => {
    expect(getNestedConditionIssues(condition('envelope.title', 'matches_regex', '(unclosed'))).toEqual([
      nestedConditionIssue('value', 'REGEX_INVALID'),
    ]);
  });

  // Sign-up rules run after the account exists, so there is nothing left to block.
  it('sign-up rules cannot block the event but can flag the account', () => {
    expect(getActionIssues('USER_SIGNED_UP', block)).toEqual([actionTypeUnavailable]);
    expect(getActionIssues('USER_SIGNED_UP', flag)).toEqual([]);
  });

  // Disabling emails needs an organisation, which user-level events don't belong to.
  it('disabling emails is only available on events that belong to an organisation', () => {
    expect(getActionIssues('USER_SIGNED_UP', disableEmails)).toEqual([actionTypeUnavailable]);
    expect(getActionIssues('USER_NAME_CHANGED', disableEmails)).toEqual([actionTypeUnavailable]);
    expect(getActionIssues('DOCUMENT_SENT', disableEmails)).toEqual([]);
  });

  it('flagging an account for review needs a reason', () => {
    expect(getActionIssues('DOCUMENT_SENT', { type: 'flag_account_for_review', params: { reason: ' ' } })).toEqual([
      { path: ['actions', 0, 'params', 'reason'], code: 'PARAM_REQUIRED' },
    ]);
  });

  it('rejects groups nested deeper than the limit', () => {
    let atLimit = all(condition('envelope.title', 'contains', 'x'));

    for (let depth = 1; depth < ADMIN_RULE_LIMITS.maxGroupDepth; depth++) {
      atLimit = all(atLimit);
    }

    expect(getAdminRuleDefinitionIssues('DOCUMENT_SENT', definition(atLimit))).toEqual([]);

    const issues = getAdminRuleDefinitionIssues('DOCUMENT_SENT', definition(all(atLimit)));

    expect(issues).toHaveLength(1);
    expect(issues[0].code).toEqual('GROUP_TOO_DEEP');
  });

  it('counts conditions at every nesting level against the limit', () => {
    const conditions = (count: number) =>
      Array.from({ length: count }, () => condition('envelope.title', 'contains', 'x'));

    const atLimit = all(...conditions(1), any(...conditions(ADMIN_RULE_LIMITS.maxConditions - 1)));
    const overLimit = all(...conditions(1), any(...conditions(ADMIN_RULE_LIMITS.maxConditions)));

    expect(getAdminRuleDefinitionIssues('DOCUMENT_SENT', definition(atLimit))).toEqual([]);
    expect(getAdminRuleDefinitionIssues('DOCUMENT_SENT', definition(overLimit))).toEqual([
      { path: ['when'], code: 'TOO_MANY_CONDITIONS' },
    ]);
  });
});

describe('evaluateAdminRuleWithLoaders', () => {
  // A free-plan volume rule, with the condition that needs a query first.
  const volumeRule = definition(
    all(condition('sender.documents_sent_last_24h', 'greater_than', '20'), condition('sender.plan', 'is', 'free')),
  );

  // Loaders that record every field they load.
  const createFieldLoaders = (values: TAdminRuleContext) => {
    const loadedFields: string[] = [];

    const fieldLoaders = Object.fromEntries(
      Object.entries(values).map(([field, value]) => [
        field,
        () => {
          loadedFields.push(field);

          return Promise.resolve(value);
        },
      ]),
    );

    return { fieldLoaders, loadedFields };
  };

  it('loads a field only when the known fields cannot settle the rule', async () => {
    const paidPlan = createFieldLoaders({ 'sender.documents_sent_last_24h': 25 });

    const isPaidPlanMatch = await evaluateAdminRuleWithLoaders({
      definition: volumeRule,
      context: { 'sender.plan': 'team' },
      fieldLoaders: paidPlan.fieldLoaders,
    });

    expect(isPaidPlanMatch).toBe(false);
    expect(paidPlan.loadedFields).toEqual([]);

    const freePlan = createFieldLoaders({ 'sender.documents_sent_last_24h': 25 });

    const isFreePlanMatch = await evaluateAdminRuleWithLoaders({
      definition: volumeRule,
      context: { 'sender.plan': 'free' },
      fieldLoaders: freePlan.fieldLoaders,
    });

    expect(isFreePlanMatch).toBe(true);
    expect(freePlan.loadedFields).toEqual(['sender.documents_sent_last_24h']);
  });

  it('skips fields in groups that are already settled', async () => {
    // (sender.plan is free AND documents sent in 24h > 20) OR documents sent in 7d > 100
    const rule = definition(
      any(
        all(condition('sender.plan', 'is', 'free'), condition('sender.documents_sent_last_24h', 'greater_than', '20')),
        condition('sender.documents_sent_last_7d', 'greater_than', '100'),
      ),
    );

    const { fieldLoaders, loadedFields } = createFieldLoaders({
      'sender.documents_sent_last_24h': 25,
      'sender.documents_sent_last_7d': 150,
    });

    const isMatch = await evaluateAdminRuleWithLoaders({
      definition: rule,
      context: { 'sender.plan': 'team' },
      fieldLoaders,
    });

    expect(isMatch).toBe(true);
    expect(loadedFields).toEqual(['sender.documents_sent_last_7d']);
  });

  it('loads each field at most once per event', async () => {
    const { fieldLoaders, loadedFields } = createFieldLoaders({ 'sender.documents_sent_last_24h': 25 });

    const context: TAdminRuleContext = { 'sender.plan': 'free' };

    await evaluateAdminRuleWithLoaders({ definition: volumeRule, context, fieldLoaders });
    await evaluateAdminRuleWithLoaders({ definition: volumeRule, context, fieldLoaders });

    expect(loadedFields).toEqual(['sender.documents_sent_last_24h']);
  });
});
