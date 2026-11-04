import { match } from 'ts-pattern';
import {
  ADMIN_RULE_ACTIONS,
  ADMIN_RULE_LIMITS,
  ADMIN_RULE_LIST_OPERATORS,
  ADMIN_RULE_MAX_REGEX_LENGTH,
  ADMIN_RULE_OPERATORS_BY_FIELD_TYPE,
  ADMIN_RULE_REGEX_OPERATORS,
  ADMIN_RULE_TRIGGER_FIELDS,
  ADMIN_RULE_TRIGGER_SUPPORTS_ORGANISATION_EXEMPTIONS,
  ADMIN_RULE_VALUELESS_OPERATORS,
  type AdminRuleField,
} from '../constants/admin-rules';
import { AppError, AppErrorCode } from '../errors/app-error';
import type {
  TAdminRuleAction,
  TAdminRuleCondition,
  TAdminRuleConditionGroup,
  TAdminRuleContext,
  TAdminRuleContextValue,
  TAdminRuleDefinition,
  TAdminRuleOperator,
  TAdminRuleTrigger,
} from '../types/admin-rules';

export const getAdminRuleField = (trigger: TAdminRuleTrigger, fieldKey: string): AdminRuleField | undefined => {
  return ADMIN_RULE_TRIGGER_FIELDS[trigger].find((field) => field.key === fieldKey);
};

export const isAdminRuleOperatorValueless = (operator: TAdminRuleOperator) =>
  ADMIN_RULE_VALUELESS_OPERATORS.includes(operator);

export const isAdminRuleOperatorList = (operator: TAdminRuleOperator) => ADMIN_RULE_LIST_OPERATORS.includes(operator);

export const isAdminRuleOperatorRegex = (operator: TAdminRuleOperator) => ADMIN_RULE_REGEX_OPERATORS.includes(operator);

export const isAdminRuleOperatorValidForField = (field: AdminRuleField | undefined, operator: TAdminRuleOperator) => {
  if (!field) {
    return false;
  }

  return ADMIN_RULE_OPERATORS_BY_FIELD_TYPE[field.type].includes(operator);
};

export const parseAdminRuleListValue = (value: string) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item !== '');

/**
 * Compiles a user supplied regex with a length guard. Returns `null` when the pattern is invalid.
 */
export const compileAdminRuleRegex = (pattern: string): RegExp | null => {
  if (pattern.length === 0 || pattern.length > ADMIN_RULE_MAX_REGEX_LENGTH) {
    return null;
  }

  try {
    return new RegExp(pattern, 'i');
  } catch {
    return null;
  }
};

const normaliseString = (value: string) => value.trim().toLowerCase();

const toStringValue = (value: TAdminRuleContextValue | undefined): string => {
  if (value === undefined || value === null) {
    return '';
  }

  if (Array.isArray(value)) {
    return value.join(',');
  }

  return String(value);
};

const toNumberValue = (value: TAdminRuleContextValue | undefined): number | null => {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);

    return Number.isNaN(parsed) ? null : parsed;
  }

  return null;
};

const toBooleanValue = (value: TAdminRuleContextValue | undefined): boolean => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    return value.toLowerCase() === 'true';
  }

  if (typeof value === 'number') {
    return value !== 0;
  }

  return false;
};

const toListValue = (value: TAdminRuleContextValue | undefined): string[] => {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === 'string') {
    return parseAdminRuleListValue(value);
  }

  return [];
};

export const evaluateAdminRuleCondition = (condition: TAdminRuleCondition, context: TAdminRuleContext): boolean => {
  const rawValue = context[condition.field];
  const expected = condition.value;

  return match(condition.operator)
    .with('equals', () => {
      if (typeof rawValue === 'number') {
        return rawValue === Number(expected);
      }

      return normaliseString(toStringValue(rawValue)) === normaliseString(expected);
    })
    .with('contains', () => {
      if (Array.isArray(rawValue)) {
        return rawValue.some((item) => normaliseString(item) === normaliseString(expected));
      }

      return normaliseString(toStringValue(rawValue)).includes(normaliseString(expected));
    })
    .with('starts_with', () => normaliseString(toStringValue(rawValue)).startsWith(normaliseString(expected)))
    .with('ends_with', () => normaliseString(toStringValue(rawValue)).endsWith(normaliseString(expected)))
    .with('matches_regex', () => {
      const regex = compileAdminRuleRegex(expected);

      return regex ? regex.test(toStringValue(rawValue)) : false;
    })
    .with('in_list', () => {
      const list = parseAdminRuleListValue(expected).map((item) => normaliseString(item));

      return list.includes(normaliseString(toStringValue(rawValue)));
    })
    .with('is_empty', () => {
      if (Array.isArray(rawValue)) {
        return rawValue.length === 0;
      }

      return toStringValue(rawValue).trim() === '';
    })
    .with('greater_than', 'greater_than_or_equal', 'less_than', 'less_than_or_equal', (operator) => {
      const actual = toNumberValue(rawValue);
      const target = Number(expected);

      if (actual === null || Number.isNaN(target)) {
        return false;
      }

      return match(operator)
        .with('greater_than', () => actual > target)
        .with('greater_than_or_equal', () => actual >= target)
        .with('less_than', () => actual < target)
        .with('less_than_or_equal', () => actual <= target)
        .exhaustive();
    })
    .with('between', () => {
      const actual = toNumberValue(rawValue);
      const [min, max] = parseAdminRuleListValue(expected).map(Number);

      if (actual === null || min === undefined || max === undefined || Number.isNaN(min) || Number.isNaN(max)) {
        return false;
      }

      return actual >= min && actual <= max;
    })
    .with('is_true', () => toBooleanValue(rawValue))
    .with('is_false', () => !toBooleanValue(rawValue))
    .with('is', () => normaliseString(toStringValue(rawValue)) === normaliseString(expected))
    .with('any_matches_regex', () => {
      const regex = compileAdminRuleRegex(expected);

      return regex ? toListValue(rawValue).some((item) => regex.test(item)) : false;
    })
    .with('all_in_list', () => {
      const list = parseAdminRuleListValue(expected).map((item) => normaliseString(item));
      const actual = toListValue(rawValue);

      return actual.length > 0 && actual.every((item) => list.includes(normaliseString(item)));
    })
    .with('any_in_list', () => {
      const list = parseAdminRuleListValue(expected).map((item) => normaliseString(item));

      return toListValue(rawValue).some((item) => list.includes(normaliseString(item)));
    })
    .with('count_greater_than', () => {
      const target = Number(expected);

      return !Number.isNaN(target) && toListValue(rawValue).length > target;
    })
    .exhaustive();
};

type AdminRuleGroupOutcome = { isMatch: boolean } | { pendingField: string };

type EvaluateAdminRuleGroupWithPendingFieldsOptions = {
  group: TAdminRuleConditionGroup;
  context: TAdminRuleContext;
  /**
   * Fields that need a query and haven't been loaded yet.
   */
  pendingFields: ReadonlySet<string>;
};

/**
 * Evaluates a group while some fields haven't been loaded. They don't matter once the loaded fields
 * settle the group: one false condition fails an `all` group, and one true condition passes an `any`
 * group. Otherwise this returns the first pending field that could still change the result.
 */
const evaluateAdminRuleGroupWithPendingFields = ({
  group,
  context,
  pendingFields,
}: EvaluateAdminRuleGroupWithPendingFieldsOptions): AdminRuleGroupOutcome => {
  let firstPendingField: string | null = null;

  for (const child of group.children) {
    let outcome: AdminRuleGroupOutcome;

    if (child.type === 'group') {
      outcome = evaluateAdminRuleGroupWithPendingFields({ group: child, context, pendingFields });
    } else if (pendingFields.has(child.field)) {
      outcome = { pendingField: child.field };
    } else {
      outcome = { isMatch: evaluateAdminRuleCondition(child, context) };
    }

    if ('pendingField' in outcome) {
      if (firstPendingField === null) {
        firstPendingField = outcome.pendingField;
      }

      continue;
    }

    // One false condition fails an `all` group, and one true condition passes an `any` group.
    const failsAllGroup = group.match === 'all' && !outcome.isMatch;
    const passesAnyGroup = group.match === 'any' && outcome.isMatch;

    if (failsAllGroup || passesAnyGroup) {
      return outcome;
    }
  }

  if (firstPendingField !== null) {
    return {
      pendingField: firstPendingField,
    };
  }

  // Nothing settled it early: every condition of an `all` group held, or none of an `any` group did.
  return {
    isMatch: group.match === 'all',
  };
};

/**
 * Whether a condition group holds for the event. Groups short-circuit like `&&` and `||`, so the
 * remaining conditions are skipped as soon as the outcome is known.
 */
export const evaluateAdminRuleConditionGroup = (
  group: TAdminRuleConditionGroup,
  context: TAdminRuleContext,
): boolean => {
  const outcome = evaluateAdminRuleGroupWithPendingFields({ group, context, pendingFields: new Set<string>() });

  // Never true, since nothing is pending. It only narrows the type so `outcome.isMatch` compiles.
  if ('pendingField' in outcome) {
    return false;
  }

  return outcome.isMatch;
};

/**
 * Whether the rule's conditions hold for the event.
 */
export const evaluateAdminRule = (definition: TAdminRuleDefinition, context: TAdminRuleContext) =>
  evaluateAdminRuleConditionGroup(definition.when, context);

/**
 * Functions that load the fields needing a query, keyed by field.
 */
export type AdminRuleFieldLoaders = Record<string, () => Promise<TAdminRuleContextValue>>;

export type EvaluateAdminRuleWithLoadersOptions = {
  definition: TAdminRuleDefinition;
  /**
   * The fields known so far. Loaded fields are added to it, so other rules for the same event reuse
   * them.
   */
  context: TAdminRuleContext;
  fieldLoaders: AdminRuleFieldLoaders;
};

/**
 * Whether the rule's conditions hold for the event, when some fields need a query. A field is only
 * loaded when the fields already known can't settle the rule, one at a time. So
 * `sender.plan is free AND sender.documents_sent_last_24h > 20` never counts documents for a paid
 * organisation, whichever condition comes first.
 */
export const evaluateAdminRuleWithLoaders = async ({
  definition,
  context,
  fieldLoaders,
}: EvaluateAdminRuleWithLoadersOptions): Promise<boolean> => {
  const evaluate = () =>
    evaluateAdminRuleGroupWithPendingFields({
      group: definition.when,
      context,
      pendingFields: new Set(Object.keys(fieldLoaders).filter((field) => !(field in context))),
    });

  let outcome = evaluate();

  while ('pendingField' in outcome) {
    context[outcome.pendingField] = await fieldLoaders[outcome.pendingField]();
    outcome = evaluate();
  }

  return outcome.isMatch;
};

/**
 * Every condition in a group at any depth, in display order.
 */
export const getAdminRuleGroupConditions = (group: TAdminRuleConditionGroup): TAdminRuleCondition[] =>
  group.children.flatMap((child) => (child.type === 'group' ? getAdminRuleGroupConditions(child) : [child]));

/**
 * Formats a single condition as a compact, readable expression (e.g. `user.new_name contains "SUSPICIOUS"`).
 * Operator labels are supplied by the caller so they can be translated.
 */
export const formatAdminRuleConditionExpression = (condition: TAdminRuleCondition, operatorLabel: string) => {
  if (isAdminRuleOperatorValueless(condition.operator)) {
    return `${condition.field} ${operatorLabel}`;
  }

  if (isAdminRuleOperatorRegex(condition.operator)) {
    return `${condition.field} ${operatorLabel} /${condition.value}/i`;
  }

  if (isAdminRuleOperatorList(condition.operator)) {
    return `${condition.field} ${operatorLabel} [${parseAdminRuleListValue(condition.value).join(', ')}]`;
  }

  const isNumeric = condition.value.trim() !== '' && !Number.isNaN(Number(condition.value));

  return `${condition.field} ${operatorLabel} ${isNumeric ? condition.value : `"${condition.value}"`}`;
};

export type AdminRuleDefinitionIssueCode =
  | 'FIELD_INVALID'
  | 'OPERATOR_INVALID'
  | 'VALUE_REQUIRED'
  | 'VALUE_NOT_A_NUMBER'
  | 'VALUE_NOT_A_RANGE'
  | 'REGEX_INVALID'
  | 'ACTION_UNAVAILABLE'
  | 'PARAM_REQUIRED'
  | 'GROUP_TOO_DEEP'
  | 'TOO_MANY_CONDITIONS';

export type AdminRuleDefinitionIssue = {
  path: (string | number)[];
  code: AdminRuleDefinitionIssueCode;
};

/**
 * Checks a definition against the registry for the given trigger: fields must exist, operators
 * must suit the field type, values must be present (numbers where numbers are compared, valid
 * regexes), required action parameters must be filled, and group nesting and condition counts
 * must stay within `ADMIN_RULE_LIMITS`. Paths are relative to the definition so forms can map them
 * to inputs; the editor translates the codes with `ADMIN_RULE_DEFINITION_ISSUE_MAP`.
 */
export const getAdminRuleDefinitionIssues = (
  trigger: TAdminRuleTrigger,
  definition: TAdminRuleDefinition,
): AdminRuleDefinitionIssue[] => {
  const issues: AdminRuleDefinitionIssue[] = [];

  const checkActions = (actions: TAdminRuleAction[], basePath: (string | number)[]) => {
    actions.forEach((action, actionIndex) => {
      const { allowedTriggers, params } = ADMIN_RULE_ACTIONS[action.type];

      if (allowedTriggers !== 'all' && !allowedTriggers.includes(trigger)) {
        issues.push({ path: [...basePath, actionIndex, 'type'], code: 'ACTION_UNAVAILABLE' });
        return;
      }

      for (const param of params) {
        if (!param.required) {
          continue;
        }

        const value = action.params[param.key];

        const isMissing =
          value === undefined ||
          value === null ||
          (typeof value === 'string' && value.trim() === '') ||
          (typeof value === 'number' && param.kind === 'number' && value <= 0);

        if (isMissing) {
          issues.push({ path: [...basePath, actionIndex, 'params', param.key], code: 'PARAM_REQUIRED' });
        }
      }
    });
  };

  const checkCondition = (condition: TAdminRuleCondition, path: (string | number)[]) => {
    const field = getAdminRuleField(trigger, condition.field);

    if (!field) {
      issues.push({ path: [...path, 'field'], code: 'FIELD_INVALID' });
      return;
    }

    if (!isAdminRuleOperatorValidForField(field, condition.operator)) {
      issues.push({ path: [...path, 'operator'], code: 'OPERATOR_INVALID' });
      return;
    }

    if (isAdminRuleOperatorValueless(condition.operator)) {
      return;
    }

    if (condition.value.trim() === '') {
      issues.push({ path: [...path, 'value'], code: 'VALUE_REQUIRED' });
      return;
    }

    if (condition.operator === 'between') {
      const bounds = parseAdminRuleListValue(condition.value).map(Number);

      if (bounds.length !== 2 || !bounds.every(Number.isFinite) || bounds[0] > bounds[1]) {
        issues.push({ path: [...path, 'value'], code: 'VALUE_NOT_A_RANGE' });
      }

      return;
    }

    const isNumericValue = field.type === 'number' || condition.operator === 'count_greater_than';

    if (isNumericValue && !Number.isFinite(Number(condition.value))) {
      issues.push({ path: [...path, 'value'], code: 'VALUE_NOT_A_NUMBER' });
      return;
    }

    if (isAdminRuleOperatorRegex(condition.operator) && compileAdminRuleRegex(condition.value) === null) {
      issues.push({ path: [...path, 'value'], code: 'REGEX_INVALID' });
    }
  };

  const checkGroup = (group: TAdminRuleConditionGroup, path: (string | number)[], depth: number) => {
    if (depth > ADMIN_RULE_LIMITS.maxGroupDepth) {
      issues.push({ path, code: 'GROUP_TOO_DEEP' });
      return;
    }

    group.children.forEach((child, childIndex) => {
      const childPath = [...path, 'children', childIndex];

      if (child.type === 'group') {
        checkGroup(child, childPath, depth + 1);
        return;
      }

      checkCondition(child, childPath);
    });
  };

  if (getAdminRuleGroupConditions(definition.when).length > ADMIN_RULE_LIMITS.maxConditions) {
    issues.push({ path: ['when'], code: 'TOO_MANY_CONDITIONS' });
  }

  checkGroup(definition.when, ['when'], 1);
  checkActions(definition.actions, ['actions']);

  return issues;
};

export const validateAdminRuleDefinition = (trigger: TAdminRuleTrigger, definition: TAdminRuleDefinition) => {
  const [issue] = getAdminRuleDefinitionIssues(trigger, definition);

  if (issue) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: `Invalid rule definition at ${issue.path.join('.')}: ${issue.code}`,
    });
  }
};

export const validateAdminRuleExemptions = (trigger: TAdminRuleTrigger, exemptOrganisationIds: string[]) => {
  if (exemptOrganisationIds.length > 0 && !ADMIN_RULE_TRIGGER_SUPPORTS_ORGANISATION_EXEMPTIONS[trigger]) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: `Organisation exemptions are not supported on the ${trigger} trigger`,
    });
  }
};
