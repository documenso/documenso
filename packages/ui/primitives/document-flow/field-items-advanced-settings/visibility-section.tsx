import { useMemo } from 'react';

import { Trans } from '@lingui/react/macro';
import { FieldType } from '@prisma/client';
import { PlusIcon, TrashIcon } from 'lucide-react';

import type { TVisibilityBlock, TVisibilityRule } from '@documenso/lib/types/field-meta';
import { Button } from '@documenso/ui/primitives/button';
import { Input } from '@documenso/ui/primitives/input';
import { Label } from '@documenso/ui/primitives/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@documenso/ui/primitives/select';

type EligibleTriggerField = {
  id: number;
  type: FieldType;
  stableId?: string;
  label?: string;
  page?: number;
  values?: Array<{ value: string }>;
};

type Props = {
  /** The field being edited. */
  currentFieldId: number | null;
  /** Used by parent to filter – kept for API symmetry even if unused internally. */
  currentFieldType?: FieldType;
  /** All same-recipient fields available as triggers. */
  triggerCandidates: EligibleTriggerField[];
  value: TVisibilityBlock | undefined;
  onChange: (next: TVisibilityBlock | undefined) => void;
};

type ValueOperator = 'equals' | 'notEquals' | 'contains' | 'notContains';
type EmptyOperator = 'isEmpty' | 'isNotEmpty';
type AnyOperator = TVisibilityRule['operator'];

type ValueRule = Extract<TVisibilityRule, { value: string }>;

const ELIGIBLE_FIELD_TYPES: FieldType[] = [
  FieldType.RADIO,
  FieldType.CHECKBOX,
  FieldType.DROPDOWN,
  FieldType.TEXT,
];

const OPERATORS_BY_TYPE: Partial<Record<FieldType, AnyOperator[]>> = {
  [FieldType.RADIO]: ['equals', 'notEquals', 'isEmpty', 'isNotEmpty'],
  [FieldType.DROPDOWN]: ['equals', 'notEquals', 'isEmpty', 'isNotEmpty'],
  [FieldType.CHECKBOX]: ['contains', 'notContains', 'isEmpty', 'isNotEmpty'],
  [FieldType.TEXT]: ['equals', 'notEquals', 'contains', 'isEmpty', 'isNotEmpty'],
};

const OPERATOR_LABELS: Record<AnyOperator, string> = {
  equals: 'equals',
  notEquals: 'does not equal',
  contains: 'contains',
  notContains: 'does not contain',
  isEmpty: 'is empty',
  isNotEmpty: 'is not empty',
};

const isEmptyOperator = (op: AnyOperator): op is EmptyOperator =>
  op === 'isEmpty' || op === 'isNotEmpty';

const isValueOperator = (op: AnyOperator): op is ValueOperator => !isEmptyOperator(op);

const isValueRule = (rule: TVisibilityRule): rule is ValueRule => 'value' in rule;

/** Extract .value safely from a discriminated-union rule. */
const getRuleValue = (rule: TVisibilityRule): string => (isValueRule(rule) ? rule.value : '');

const labelForTrigger = (t: EligibleTriggerField, idx: number) =>
  t.label?.trim()
    ? `${t.label} · ${t.type.toLowerCase()} · p.${t.page ?? 1}`
    : `Unnamed ${t.type.toLowerCase()} #${idx + 1}`;

export const VisibilitySection = ({
  currentFieldId,
  triggerCandidates,
  value,
  onChange,
}: Props) => {
  const eligibleTriggers = useMemo(
    () =>
      triggerCandidates
        .filter((t) => ELIGIBLE_FIELD_TYPES.includes(t.type))
        .filter((t) => t.id !== currentFieldId),
    [triggerCandidates, currentFieldId],
  );

  const rules = value?.rules ?? [];

  /**
   * Build a valid TVisibilityRule from the current rule merged with a patch.
   * We re-derive the discriminated union shape from the merged operator.
   */
  const buildUpdatedRule = (
    current: TVisibilityRule,
    patch: Partial<TVisibilityRule>,
  ): TVisibilityRule => {
    const merged = { ...current, ...patch };
    const op = merged.operator;

    if (isEmptyOperator(op)) {
      return { operator: op, triggerFieldStableId: merged.triggerFieldStableId };
    }

    const currentValue = isValueRule(current) ? current.value : '';
    const patchValueEntry = 'value' in patch ? patch : null;
    const patchValue =
      patchValueEntry !== null && isValueOperator(op)
        ? (patchValueEntry.value ?? currentValue)
        : currentValue;

    return {
      operator: op,
      triggerFieldStableId: merged.triggerFieldStableId,
      value: patchValue,
    };
  };

  const updateRule = (index: number, patch: Partial<TVisibilityRule>) => {
    const next = [...rules];
    const updated = buildUpdatedRule(next[index], patch);
    next[index] = updated;
    onChange({ match: value?.match ?? 'all', rules: next });
  };

  const addRule = () => {
    const firstTrigger = eligibleTriggers[0];
    if (!firstTrigger?.stableId) {
      onChange(undefined);
      return;
    }
    const newRule: TVisibilityRule = {
      operator: 'equals',
      triggerFieldStableId: firstTrigger.stableId,
      value: '',
    };
    onChange({ match: value?.match ?? 'all', rules: [...rules, newRule] });
  };

  const removeRule = (index: number) => {
    const next = rules.filter((_, i) => i !== index);
    onChange(next.length === 0 ? undefined : { match: value?.match ?? 'all', rules: next });
  };

  return (
    <div className="mt-4 rounded-md border border-border bg-muted/40 p-3">
      <Label className="text-sm font-semibold">
        <Trans>Visibility</Trans>
      </Label>

      {eligibleTriggers.length === 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          <Trans>
            Add a radio, checkbox, dropdown, or text field to the same recipient to use visibility
            rules.
          </Trans>
        </p>
      )}

      {rules.length >= 2 && (
        <div className="mt-2 flex items-center gap-2 text-xs">
          <Button
            variant={value?.match === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => onChange({ match: 'all', rules })}
          >
            <Trans>Match ALL</Trans>
          </Button>
          <Button
            variant={value?.match === 'any' ? 'default' : 'outline'}
            size="sm"
            onClick={() => onChange({ match: 'any', rules })}
          >
            <Trans>Match ANY</Trans>
          </Button>
        </div>
      )}

      <div className="mt-2 space-y-2">
        {rules.map((rule, index) => {
          const trigger = eligibleTriggers.find((t) => t.stableId === rule.triggerFieldStableId);
          const operators: AnyOperator[] = trigger ? (OPERATORS_BY_TYPE[trigger.type] ?? []) : [];
          const needsValue = isValueOperator(rule.operator);
          const isTextTrigger = trigger?.type === FieldType.TEXT;
          const enumOptions = needsValue && !isTextTrigger ? (trigger?.values ?? []) : null;

          return (
            <div
              key={index}
              className="flex flex-wrap items-center gap-2 rounded border bg-background p-2"
            >
              <Select
                value={rule.triggerFieldStableId}
                onValueChange={(v) => updateRule(index, { triggerFieldStableId: v })}
              >
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {eligibleTriggers.map((t, i) => (
                    <SelectItem key={t.id} value={t.stableId ?? `__noid_${t.id}`}>
                      {labelForTrigger(t, i)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={rule.operator}
                onValueChange={(op) => {
                  const matched = operators.find((o) => o === op);
                  if (matched) {
                    updateRule(index, { operator: matched });
                  }
                }}
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {operators.map((op) => (
                    <SelectItem key={op} value={op}>
                      {OPERATOR_LABELS[op]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {needsValue && enumOptions && (
                <Select
                  value={getRuleValue(rule)}
                  onValueChange={(v) => updateRule(index, { value: v })}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {enumOptions.map((o, i) => (
                      <SelectItem key={i} value={o.value}>
                        {o.value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {needsValue && isTextTrigger && (
                <Input
                  className="w-40"
                  value={getRuleValue(rule)}
                  onChange={(e) => updateRule(index, { value: e.target.value })}
                />
              )}

              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeRule(index)}
                aria-label="Remove rule"
              >
                <TrashIcon className="h-4 w-4" />
              </Button>
            </div>
          );
        })}
      </div>

      <div className="mt-2 flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={addRule}
          disabled={eligibleTriggers.length === 0}
        >
          <PlusIcon className="mr-1 h-4 w-4" />
          <Trans>Add rule</Trans>
        </Button>
      </div>

      {rules.some((r) => {
        const t = eligibleTriggers.find((tt) => tt.stableId === r.triggerFieldStableId);
        return t?.type === FieldType.TEXT;
      }) && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          <Trans>Text matching is case-insensitive and ignores leading/trailing whitespace.</Trans>
        </p>
      )}
    </div>
  );
};
