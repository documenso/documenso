import {
  ADMIN_RULE_LIMITS,
  ADMIN_RULE_OPERATORS_BY_FIELD_TYPE,
  ADMIN_RULE_TRIGGER_FIELDS,
} from '@documenso/lib/constants/admin-rules';
import { ADMIN_RULE_GROUP_MATCH_MAP } from '@documenso/lib/constants/admin-rules-translations';
import {
  type TAdminRuleCondition,
  type TAdminRuleConditionGroup,
  type TAdminRuleGroupMatch,
  type TAdminRuleTrigger,
  ZAdminRuleGroupMatchSchema,
} from '@documenso/lib/types/admin-rules';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import { FormControl, FormField, FormItem, FormLabel } from '@documenso/ui/primitives/form/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@documenso/ui/primitives/select';
import { Plural, Trans, useLingui } from '@lingui/react/macro';
import { PlusIcon, XIcon } from 'lucide-react';
import { useFieldArray, useFormContext, useWatch } from 'react-hook-form';

import type { AdminRuleConditionGroupPath, TAdminRuleFormSchema } from '~/components/forms/admin-rule-form';
import { AdminRuleConditionFields } from '~/components/general/admin-rules/admin-rule-condition-fields';
import {
  ADMIN_RULE_CONDITION_ROW_CLASS,
  ADMIN_RULE_JOINER_LABEL_CLASS,
  ADMIN_RULE_SELECT_TRIGGER_CLASS,
} from '~/components/general/admin-rules/admin-rule-styles';

export type AdminRuleConditionGroupFieldsProps = {
  /**
   * Form path of the group: the rule's `when`, or a group nested in another group's children.
   */
  path: string;
  /**
   * Nesting level, where the rule's own group is 1.
   */
  depth: number;
  trigger: TAdminRuleTrigger;
  /**
   * False once the rule holds `ADMIN_RULE_LIMITS.maxConditions` conditions.
   */
  canAddCondition: boolean;
  /**
   * Removes this group from its parent. Absent when the group has to stay, like the rule's own group.
   */
  onRemove?: () => void;
};

/**
 * Conditions joined with AND / OR, rendered as rows that read like a sentence: "where …", then
 * "and …" or "or …". Nested groups render as inset boxes, so `a AND (b OR c)` looks exactly the way
 * it is evaluated.
 */
export const AdminRuleConditionGroupFields = ({
  path,
  depth,
  trigger,
  canAddCondition,
  onRemove,
}: AdminRuleConditionGroupFieldsProps) => {
  const { t, i18n } = useLingui();

  const form = useFormContext<TAdminRuleFormSchema>();

  const groupPath = path as AdminRuleConditionGroupPath;

  const {
    fields: children,
    append,
    remove,
  } = useFieldArray({
    control: form.control,
    name: `${groupPath}.children`,
  });

  const match = useWatch({ control: form.control, name: `${groupPath}.match` });

  const isNested = depth > 1;
  const canAddGroup = depth < ADMIN_RULE_EDITOR_MAX_GROUP_DEPTH;

  // Groups are never left empty: removing the last child removes the group from its parent instead.
  const canRemoveChild = children.length > 1 || onRemove !== undefined;

  const removeChild = (index: number) => {
    if (children.length > 1) {
      remove(index);
      return;
    }

    onRemove?.();
  };

  const childrenError = form.getFieldState(`${groupPath}.children`, form.formState).error;
  const groupError =
    childrenError?.root?.message ??
    childrenError?.message ??
    form.getFieldState(groupPath, form.formState).error?.message;

  const maxConditions = ADMIN_RULE_LIMITS.maxConditions;

  const addButtonProps = isNested
    ? ({ variant: 'ghost', className: 'h-7 px-2 text-muted-foreground text-xs hover:text-foreground' } as const)
    : ({ variant: 'outline', className: 'h-8 bg-background text-[13px]' } as const);

  return (
    <div className="flex flex-col gap-2">
      {children.map((child, index) => {
        const childPath = `${groupPath}.children.${index}`;

        const joiner = <AdminRuleConditionJoiner groupPath={groupPath} index={index} match={match} />;

        if (child.type === 'condition') {
          return (
            <AdminRuleConditionFields
              key={child.id}
              path={childPath}
              trigger={trigger}
              joiner={joiner}
              canRemove={canRemoveChild}
              onRemove={() => removeChild(index)}
            />
          );
        }

        return (
          <div key={child.id} className={ADMIN_RULE_CONDITION_ROW_CLASS}>
            {joiner}

            <div
              className={cn(
                'min-w-0 rounded-lg border border-border p-3',
                depth % 2 === 1 ? 'bg-muted/40' : 'bg-background',
              )}
              data-testid="admin-rule-condition-group"
            >
              <AdminRuleConditionGroupFields
                path={childPath}
                depth={depth + 1}
                trigger={trigger}
                canAddCondition={canAddCondition}
                onRemove={canRemoveChild ? () => removeChild(index) : undefined}
              />
            </div>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-[3px] h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
              disabled={!canRemoveChild}
              onClick={() => removeChild(index)}
              title={t`Remove group`}
            >
              <XIcon className="h-4 w-4" />
              <span className="sr-only">
                <Trans>Remove group</Trans>
              </span>
            </Button>
          </div>
        );
      })}

      {groupError && <p className="font-medium text-destructive text-sm">{i18n._(groupError)}</p>}

      <div className={ADMIN_RULE_CONDITION_ROW_CLASS}>
        <span />

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            {...addButtonProps}
            disabled={!canAddCondition}
            onClick={() => append(buildEmptyAdminRuleCondition(trigger))}
          >
            <PlusIcon className="mr-1.5 -ml-1 h-3.5 w-3.5" />
            <Trans>Add condition</Trans>
          </Button>

          {canAddGroup && (
            <Button
              type="button"
              size="sm"
              {...addButtonProps}
              disabled={!canAddCondition}
              onClick={() => append(buildEmptyAdminRuleGroup(trigger))}
            >
              <PlusIcon className="mr-1.5 -ml-1 h-3.5 w-3.5" />
              <Trans>Add condition group</Trans>
            </Button>
          )}

          {!isNested && !canAddCondition && (
            <p className="text-muted-foreground text-xs">
              <Plural
                value={maxConditions}
                one="A rule can have at most # condition."
                other="A rule can have at most # conditions."
              />
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

type AdminRuleConditionJoinerProps = {
  groupPath: AdminRuleConditionGroupPath;
  index: number;
  match: TAdminRuleGroupMatch;
};

/**
 * The word in front of each row. Like most query builders, the second row holds the group's
 * and / or switch and later rows repeat the choice, so a group reads as a single expression.
 */
const AdminRuleConditionJoiner = ({ groupPath, index, match }: AdminRuleConditionJoinerProps) => {
  const { t } = useLingui();

  const form = useFormContext<TAdminRuleFormSchema>();

  if (index === 0) {
    return (
      <span className={ADMIN_RULE_JOINER_LABEL_CLASS}>
        <Trans>where</Trans>
      </span>
    );
  }

  if (index > 1) {
    return <span className={ADMIN_RULE_JOINER_LABEL_CLASS}>{t(ADMIN_RULE_GROUP_MATCH_MAP[match])}</span>;
  }

  return (
    <FormField
      control={form.control}
      name={`${groupPath}.match`}
      render={({ field }) => (
        <FormItem className="space-y-0">
          <FormLabel className="sr-only">
            <Trans>Join conditions with</Trans>
          </FormLabel>
          <Select value={field.value} onValueChange={field.onChange}>
            <FormControl>
              <SelectTrigger
                className={cn(
                  'h-[38px] w-full bg-background px-2.5 font-semibold text-[11px] uppercase tracking-wider',
                  ADMIN_RULE_SELECT_TRIGGER_CLASS,
                )}
                data-testid="admin-rule-group-match"
              >
                <SelectValue />
              </SelectTrigger>
            </FormControl>

            <SelectContent position="popper">
              {ZAdminRuleGroupMatchSchema.options.map((option) => (
                <SelectItem key={option} value={option} className="text-xs uppercase tracking-wider">
                  {t(ADMIN_RULE_GROUP_MATCH_MAP[option])}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormItem>
      )}
    />
  );
};

const buildEmptyAdminRuleCondition = (trigger: TAdminRuleTrigger): TAdminRuleCondition => {
  const field = ADMIN_RULE_TRIGGER_FIELDS[trigger][0];

  return {
    type: 'condition',
    field: field.key,
    operator: ADMIN_RULE_OPERATORS_BY_FIELD_TYPE[field.type][0],
    value: '',
  };
};

export const buildEmptyAdminRuleGroup = (trigger: TAdminRuleTrigger): TAdminRuleConditionGroup => ({
  type: 'group',
  match: 'all',
  children: [buildEmptyAdminRuleCondition(trigger)],
});

/**
 * How deep the editor lets admins nest condition groups, counting the rule's own group: one level
 * of nesting, enough for `a AND (b OR c)` while keeping rules readable. This is an editor limit only.
 * The server accepts up to `ADMIN_RULE_LIMITS.maxGroupDepth`, and deeper rules saved through the API
 * still render and stay editable here; they just can't gain new levels.
 */
const ADMIN_RULE_EDITOR_MAX_GROUP_DEPTH = Math.min(2, ADMIN_RULE_LIMITS.maxGroupDepth);
