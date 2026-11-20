import { describe, expect, it } from 'vitest';

import { ADMIN_RULE_LIMITS, ADMIN_RULE_MAX_REGEX_LENGTH } from '../constants/admin-rules';
import {
  type TAdminRuleAction,
  type TAdminRuleCondition,
  type TAdminRuleConditionGroup,
  type TAdminRuleConditionNode,
  type TAdminRuleContext,
  type TAdminRuleContextValue,
  type TAdminRuleDefinition,
  type TAdminRuleOperator,
  ZAdminRuleDefinitionSchema,
  ZAdminRuleOperatorSchema,
} from '../types/admin-rules';
import {
  evaluateAdminRule,
  evaluateAdminRuleCondition,
  evaluateAdminRuleConditionGroup,
  evaluateAdminRuleWithLoaders,
  getAdminRuleDefinitionIssues,
  getAdminRuleGroupConditions,
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
  // The operator, the condition's value, the event's value, and whether the condition holds.
  const cases: Array<[TAdminRuleOperator, string, TAdminRuleContextValue, boolean]> = [
    // String operators ignore case.
    ['equals', 'Jane Doe', 'jane doe', true],
    ['equals', 'Jane', 'Jane Doe', false],
    ['equals', '42', 42, true],
    ['equals', '42', 43, false],
    ['contains', 'invoice', 'Your Invoice #1042', true],
    ['contains', 'contract', 'Invoice #1042', false],
    // On a list, contains matches a whole item.
    ['contains', 'GMAIL.COM', ['gmail.com', 'example.com'], true],
    ['contains', 'gmail', ['gmail.com'], false],
    ['starts_with', 'invoice', 'Invoice #1042', true],
    ['starts_with', '#1042', 'Invoice #1042', false],
    ['ends_with', '#1042', 'Invoice #1042', true],
    ['ends_with', 'invoice', 'Invoice #1042', false],
    ['matches_regex', '^(admin|support)', 'Support team', true],
    ['matches_regex', '^(admin|support)', 'Jane Doe', false],
    ['in_list', 'gmail.com, yahoo.com', 'Yahoo.com', true],
    ['in_list', 'gmail.com, yahoo.com', 'example.com', false],
    ['is_empty', '', '  ', true],
    ['is_empty', '', [], true],
    ['is_empty', '', 'Jane', false],
    ['is_empty', '', ['gmail.com'], false],
    // Number operators.
    ['greater_than', '10', 11, true],
    ['greater_than', '10', 10, false],
    ['greater_than', '10', 'not a number', false],
    ['greater_than_or_equal', '10', 10, true],
    ['greater_than_or_equal', '10', 9, false],
    ['less_than', '10', 9, true],
    ['less_than', '10', 10, false],
    ['less_than_or_equal', '10', 10, true],
    ['less_than_or_equal', '10', 11, false],
    // Both bounds are included, and a range needs both.
    ['between', '5, 10', 5, true],
    ['between', '5, 10', 10, true],
    ['between', '5, 10', 11, false],
    ['between', '5', 5, false],
    // Boolean operators.
    ['is_true', '', true, true],
    ['is_true', '', false, false],
    ['is_false', '', false, true],
    ['is_false', '', true, false],
    // Enum operators.
    ['is', 'free', 'FREE', true],
    ['is', 'free', 'team', false],
    // List operators.
    ['any_matches_regex', '^gmail\\.', ['example.com', 'gmail.com'], true],
    ['any_matches_regex', '^gmail\\.', ['example.com'], false],
    ['all_in_list', 'gmail.com, example.com', ['gmail.com', 'example.com'], true],
    ['all_in_list', 'gmail.com', ['gmail.com', 'example.com'], false],
    // An empty list never matches.
    ['all_in_list', 'gmail.com', [], false],
    ['any_in_list', 'gmail.com, yahoo.com', ['example.com', 'gmail.com'], true],
    ['any_in_list', 'gmail.com, yahoo.com', ['example.com'], false],
    ['count_greater_than', '1', ['gmail.com', 'example.com'], true],
    ['count_greater_than', '2', ['gmail.com', 'example.com'], false],
  ];

  it('has cases for every operator', () => {
    expect(new Set(cases.map(([operator]) => operator))).toEqual(new Set(ZAdminRuleOperatorSchema.options));
  });

  it.each(cases)('%s %j against %j is %s', (operator, value, eventValue, expected) => {
    expect(evaluateAdminRuleCondition(condition('field', operator, value), { field: eventValue })).toBe(expected);
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

describe('evaluateAdminRule', () => {
  it('matches only when the conditions hold for the event', () => {
    const rule = definition(all(condition('envelope.recipient_count', 'greater_than', '10')));

    expect(evaluateAdminRule(rule, { 'envelope.recipient_count': 20 })).toBe(true);
    expect(evaluateAdminRule(rule, { 'envelope.recipient_count': 5 })).toBe(false);
  });

  it('ignores case and surrounding whitespace in both the value and the event', () => {
    const isPlan = definition(all(condition('sender.plan', 'is', ' Free ')));
    const equalsName = definition(all(condition('user.new_name', 'equals', 'admin')));
    const startsWithTitle = definition(all(condition('envelope.title', 'starts_with', 'invoice')));

    expect(evaluateAdminRule(isPlan, { 'sender.plan': 'free' })).toBe(true);
    expect(evaluateAdminRule(equalsName, { 'user.new_name': '  Admin ' })).toBe(true);
    expect(evaluateAdminRule(startsWithTitle, { 'envelope.title': ' Invoice #1042' })).toBe(true);
  });
});

describe('getAdminRuleGroupConditions', () => {
  it('flattens conditions from every nesting level in order', () => {
    const group = all(
      condition('envelope.title', 'contains', 'a'),
      any(condition('envelope.title', 'contains', 'b')),
      condition('envelope.title', 'contains', 'c'),
    );

    expect(getAdminRuleGroupConditions(group).map((item) => item.value)).toEqual(['a', 'b', 'c']);
  });
});

describe('getAdminRuleDefinitionIssues', () => {
  it('accepts a valid nested definition', () => {
    const rule = definition(
      all(
        condition('sender.plan', 'is', 'free'),
        any(condition('envelope.recipient_count', 'greater_than', '20'), condition('envelope.title', 'is_empty')),
      ),
    );

    expect(getAdminRuleDefinitionIssues('DOCUMENT_SENT', rule)).toEqual([]);
  });

  it('reports issues on nested conditions with their full path', () => {
    const rule = definition(all(condition('sender.plan', 'is', 'free'), any(condition('envelope.title', 'contains'))));

    expect(getAdminRuleDefinitionIssues('DOCUMENT_SENT', rule)).toEqual([
      { path: ['when', 'children', 1, 'children', 0, 'value'], code: 'VALUE_REQUIRED' },
    ]);
  });

  it('requires a number for number comparisons and list counts', () => {
    const notANumber = [{ path: ['when', 'children', 0, 'value'], code: 'VALUE_NOT_A_NUMBER' }];

    const greaterThan = definition(all(condition('envelope.recipient_count', 'greater_than', 'abc')));
    const countGreaterThan = definition(all(condition('envelope.recipient_domains', 'count_greater_than', 'x')));
    const decimal = definition(all(condition('envelope.recipient_count', 'greater_than', '2.5')));

    expect(getAdminRuleDefinitionIssues('DOCUMENT_SENT', greaterThan)).toEqual(notANumber);
    expect(getAdminRuleDefinitionIssues('DOCUMENT_SENT', countGreaterThan)).toEqual(notANumber);
    expect(getAdminRuleDefinitionIssues('DOCUMENT_SENT', decimal)).toEqual([]);
  });

  it('requires two numbers, smallest first, for between', () => {
    const notARange = [{ path: ['when', 'children', 0, 'value'], code: 'VALUE_NOT_A_RANGE' }];

    for (const value of ['5', '10, 5', '1, x', '1, 2, 3']) {
      const rule = definition(all(condition('envelope.recipient_count', 'between', value)));

      expect(getAdminRuleDefinitionIssues('DOCUMENT_SENT', rule)).toEqual(notARange);
    }

    const sameBounds = definition(all(condition('envelope.recipient_count', 'between', '5, 5')));

    expect(getAdminRuleDefinitionIssues('DOCUMENT_SENT', sameBounds)).toEqual([]);
  });

  it('rejects block actions on sign-up rules, which run after the account exists', () => {
    const when = all(condition('user.email_domain', 'equals', 'example.com'));

    expect(getAdminRuleDefinitionIssues('USER_SIGNED_UP', definition(when, [block]))).toEqual([
      { path: ['actions', 0, 'type'], code: 'ACTION_UNAVAILABLE' },
    ]);

    expect(getAdminRuleDefinitionIssues('USER_SIGNED_UP', definition(when, [flag]))).toEqual([]);
  });

  it('only offers disable emails on triggers whose event belongs to an organisation', () => {
    const unavailable = [{ path: ['actions', 0, 'type'], code: 'ACTION_UNAVAILABLE' }];

    const nameChange = definition(all(condition('user.new_name', 'contains', 'x')), [disableEmails]);
    const signUp = definition(all(condition('user.email_domain', 'equals', 'x.com')), [disableEmails]);
    const documentSent = definition(all(condition('envelope.title', 'contains', 'x')), [disableEmails]);

    expect(getAdminRuleDefinitionIssues('USER_NAME_CHANGED', nameChange)).toEqual(unavailable);
    expect(getAdminRuleDefinitionIssues('USER_SIGNED_UP', signUp)).toEqual(unavailable);
    expect(getAdminRuleDefinitionIssues('DOCUMENT_SENT', documentSent)).toEqual([]);
  });

  it('rejects groups nested deeper than the limit', () => {
    let tooDeep = all(condition('envelope.title', 'contains', 'x'));

    for (let depth = 1; depth <= ADMIN_RULE_LIMITS.maxGroupDepth; depth++) {
      tooDeep = all(tooDeep);
    }

    const issues = getAdminRuleDefinitionIssues('DOCUMENT_SENT', definition(tooDeep));

    expect(issues).toHaveLength(1);
    expect(issues[0].code).toEqual('GROUP_TOO_DEEP');
  });

  it('rejects more conditions than the limit', () => {
    const conditions = Array.from({ length: ADMIN_RULE_LIMITS.maxConditions + 1 }, () =>
      condition('envelope.title', 'contains', 'x'),
    );

    const issues = getAdminRuleDefinitionIssues('DOCUMENT_SENT', definition(all(...conditions)));

    expect(issues).toEqual([{ path: ['when'], code: 'TOO_MANY_CONDITIONS' }]);
  });
});

describe('ZAdminRuleDefinitionSchema', () => {
  it('parses nested groups and rejects empty ones', () => {
    const nested = definition(
      all(condition('envelope.title', 'contains', 'x'), any(condition('envelope.title', 'is_empty'))),
    );

    expect(ZAdminRuleDefinitionSchema.safeParse(nested).success).toBe(true);

    const empty = definition(all(condition('envelope.title', 'contains', 'x'), any()));

    expect(ZAdminRuleDefinitionSchema.safeParse(empty).success).toBe(false);
  });

  it('rejects a rule without actions', () => {
    const noActions = definition(all(condition('envelope.title', 'contains', 'x')), []);

    expect(ZAdminRuleDefinitionSchema.safeParse(noActions).success).toBe(false);
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

  it('loads nothing when the known fields already settle the rule', async () => {
    const { fieldLoaders, loadedFields } = createFieldLoaders({ 'sender.documents_sent_last_24h': 25 });

    const isMatch = await evaluateAdminRuleWithLoaders({
      definition: volumeRule,
      context: { 'sender.plan': 'team' },
      fieldLoaders,
    });

    expect(isMatch).toBe(false);
    expect(loadedFields).toEqual([]);
  });

  it('loads a field once the known fields cannot settle the rule', async () => {
    const { fieldLoaders, loadedFields } = createFieldLoaders({ 'sender.documents_sent_last_24h': 25 });

    const isMatch = await evaluateAdminRuleWithLoaders({
      definition: volumeRule,
      context: { 'sender.plan': 'free' },
      fieldLoaders,
    });

    expect(isMatch).toBe(true);
    expect(loadedFields).toEqual(['sender.documents_sent_last_24h']);
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
