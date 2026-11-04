import { ADMIN_RULE_OPERATORS_BY_FIELD_TYPE, ADMIN_RULE_TRIGGER_FIELDS } from '@documenso/lib/constants/admin-rules';
import { ADMIN_RULE_OPERATOR_MAP } from '@documenso/lib/constants/admin-rules-translations';
import type { TAdminRuleOperator, TAdminRuleTrigger } from '@documenso/lib/types/admin-rules';
import {
  getAdminRuleField,
  isAdminRuleOperatorList,
  isAdminRuleOperatorRegex,
  isAdminRuleOperatorValueless,
} from '@documenso/lib/utils/admin-rules';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@documenso/ui/primitives/form/form';
import { Input } from '@documenso/ui/primitives/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@documenso/ui/primitives/select';
import { Trans, useLingui } from '@lingui/react/macro';
import { XIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';

import type { AdminRuleConditionPath, TAdminRuleFormSchema } from '~/components/forms/admin-rule-form';
import {
  ADMIN_RULE_CONDITION_ROW_CLASS,
  ADMIN_RULE_SELECT_TRIGGER_CLASS,
} from '~/components/general/admin-rules/admin-rule-styles';

export type AdminRuleConditionFieldsProps = {
  /**
   * Form path of the condition, at any depth of the condition tree.
   */
  path: string;
  trigger: TAdminRuleTrigger;
  /**
   * Shown before the row: "where" for the first condition of a group, then "and" / "or".
   */
  joiner: ReactNode;
  canRemove: boolean;
  onRemove: () => void;
};

export const AdminRuleConditionFields = ({
  path,
  trigger,
  joiner,
  canRemove,
  onRemove,
}: AdminRuleConditionFieldsProps) => {
  const { t } = useLingui();

  const form = useFormContext<TAdminRuleFormSchema>();

  const basePath = path as AdminRuleConditionPath;

  const fieldKey = useWatch({ control: form.control, name: `${basePath}.field` });
  const operator = useWatch({ control: form.control, name: `${basePath}.operator` });

  const fields = ADMIN_RULE_TRIGGER_FIELDS[trigger];
  const fieldDefinition = getAdminRuleField(trigger, fieldKey);

  const operators = fieldDefinition ? ADMIN_RULE_OPERATORS_BY_FIELD_TYPE[fieldDefinition.type] : [];

  const isValueless = isAdminRuleOperatorValueless(operator);
  const isList = isAdminRuleOperatorList(operator);
  const isRegex = isAdminRuleOperatorRegex(operator);

  const isEnumSingle = fieldDefinition?.type === 'enum' && operator === 'is';
  const isNumeric = (fieldDefinition?.type === 'number' && !isList) || operator === 'count_greater_than';

  const onFieldChange = (nextFieldKey: string) => {
    const nextFieldDefinition = getAdminRuleField(trigger, nextFieldKey);

    form.clearErrors(basePath);

    form.setValue(`${basePath}.field`, nextFieldKey, { shouldDirty: true });

    if (nextFieldDefinition) {
      const nextOperators = ADMIN_RULE_OPERATORS_BY_FIELD_TYPE[nextFieldDefinition.type];

      if (!nextOperators.includes(operator)) {
        form.setValue(`${basePath}.operator`, nextOperators[0], { shouldDirty: true });
      }
    }

    form.setValue(`${basePath}.value`, '', { shouldDirty: true });
  };

  const onOperatorChange = (nextOperator: TAdminRuleOperator) => {
    // When a new field changes both the operator list and the operator, Radix's hidden native select
    // doesn't have the new option yet and reports an empty value. A condition always has an operator.
    if (!nextOperator) {
      return;
    }

    form.clearErrors(basePath);

    form.setValue(`${basePath}.operator`, nextOperator, { shouldDirty: true });

    if (isAdminRuleOperatorValueless(nextOperator)) {
      form.setValue(`${basePath}.value`, '', { shouldDirty: true });
    }
  };

  const valuePlaceholder = (() => {
    if (operator === 'between') {
      return t`min, max`;
    }

    // A list of enum values is compared against the raw values, so suggest those.
    if (isList && fieldDefinition?.options) {
      return fieldDefinition.options.join(', ');
    }

    if (isList) {
      return t`value1, value2, value3`;
    }

    // Regex syntax and numbers read the same in every language, so these aren't translated.
    if (isRegex) {
      return '^(admin|support)';
    }

    if (isNumeric) {
      return '0';
    }

    return '';
  })();

  return (
    <div className={ADMIN_RULE_CONDITION_ROW_CLASS}>
      {joiner}

      <div className="@container min-w-0">
        <div className="grid @xs:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)_minmax(0,1.2fr)] gap-2">
          <FormField
            control={form.control}
            name={`${basePath}.field`}
            render={({ field }) => (
              <FormItem className="min-w-0 space-y-1">
                <FormLabel className="sr-only">
                  <Trans>Field</Trans>
                </FormLabel>
                <Select value={field.value} onValueChange={onFieldChange}>
                  <FormControl>
                    <SelectTrigger
                      className={cn('h-[38px] w-full bg-background font-mono text-xs', ADMIN_RULE_SELECT_TRIGGER_CLASS)}
                      title={field.value}
                      data-testid="admin-rule-condition-field"
                    >
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>

                  <SelectContent position="popper">
                    {fields.map((option) => (
                      <SelectItem key={option.key} value={option.key} className="font-mono text-xs">
                        {option.key}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name={`${basePath}.operator`}
            render={({ field }) => (
              <FormItem className="min-w-0 space-y-1">
                <FormLabel className="sr-only">
                  <Trans>Operator</Trans>
                </FormLabel>
                <Select value={field.value} onValueChange={(value) => onOperatorChange(value as TAdminRuleOperator)}>
                  <FormControl>
                    <SelectTrigger
                      className={cn('h-[38px] w-full bg-background text-[13px]', ADMIN_RULE_SELECT_TRIGGER_CLASS)}
                      data-testid="admin-rule-condition-operator"
                    >
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>

                  <SelectContent position="popper">
                    {operators.map((option) => (
                      <SelectItem key={option} value={option}>
                        {t(ADMIN_RULE_OPERATOR_MAP[option])}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {isValueless ? (
            <div className="flex h-[38px] items-center rounded-md border border-border border-dashed px-2.5 text-[13px] text-muted-foreground">
              <Trans>no value needed</Trans>
            </div>
          ) : (
            <FormField
              control={form.control}
              name={`${basePath}.value`}
              render={({ field }) => (
                <FormItem className="min-w-0 space-y-1">
                  <FormLabel className="sr-only">
                    <Trans>Value</Trans>
                  </FormLabel>
                  {isEnumSingle && fieldDefinition?.options ? (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger
                          className={cn('h-[38px] w-full bg-background text-[13px]', ADMIN_RULE_SELECT_TRIGGER_CLASS)}
                          data-testid="admin-rule-condition-value"
                        >
                          <SelectValue placeholder={t`Select a value`} />
                        </SelectTrigger>
                      </FormControl>

                      <SelectContent position="popper">
                        {fieldDefinition.options.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <FormControl>
                      <Input
                        {...field}
                        type={isNumeric ? 'number' : 'text'}
                        inputMode={isNumeric ? 'decimal' : undefined}
                        placeholder={valuePlaceholder}
                        className={cn('h-[38px] bg-background text-[13px]', { 'font-mono text-xs': isRegex })}
                        data-testid="admin-rule-condition-value"
                      />
                    </FormControl>
                  )}

                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </div>
      </div>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="mt-[3px] h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
        disabled={!canRemove}
        onClick={onRemove}
        title={t`Remove condition`}
      >
        <XIcon className="h-4 w-4" />
        <span className="sr-only">
          <Trans>Remove condition</Trans>
        </span>
      </Button>
    </div>
  );
};
