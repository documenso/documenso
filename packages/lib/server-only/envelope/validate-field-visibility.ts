import { FieldType } from '@prisma/client';

import type { TVisibilityBlock } from '../../types/field-meta';
import { topologicalSort } from '../../universal/field-visibility/topological-sort';

export type FieldVisibilityErrorCode =
  | 'FIELD_VISIBILITY_TRIGGER_NOT_FOUND'
  | 'FIELD_VISIBILITY_TRIGGER_INELIGIBLE'
  | 'FIELD_VISIBILITY_CROSS_RECIPIENT'
  | 'FIELD_VISIBILITY_VALUE_INVALID'
  | 'FIELD_VISIBILITY_SELF_REFERENCE'
  | 'FIELD_VISIBILITY_CYCLE';

export type FieldVisibilityError = {
  fieldId: number;
  ruleIndex: number | null;
  code: FieldVisibilityErrorCode;
  message: string;
  cyclePath?: string[];
};

export type ValidatableField = {
  id: number;
  type: FieldType;
  recipientId: number;
  fieldMeta: unknown;
};

const ELIGIBLE_TRIGGER_TYPES = new Set<FieldType>([
  FieldType.RADIO,
  FieldType.CHECKBOX,
  FieldType.DROPDOWN,
  FieldType.TEXT,
]);

const extractVisibility = (field: ValidatableField): TVisibilityBlock | null => {
  const meta = field.fieldMeta as { visibility?: TVisibilityBlock } | null;
  return meta?.visibility ?? null;
};

const extractStableId = (field: ValidatableField): string | null => {
  const meta = field.fieldMeta as { stableId?: string } | null;
  return meta?.stableId ?? null;
};

const triggerOptionValues = (field: ValidatableField): string[] | null => {
  const meta = field.fieldMeta as { values?: Array<{ value: string }> } | null;
  if (!meta?.values) return null;
  return meta.values.map((v) => v.value);
};

/**
 * Validates visibility rules across a complete envelope field set.
 *
 * **Precondition:** callers must have already Zod-parsed each field's
 * `fieldMeta` with `ZFieldMetaSchema` (or equivalent). This validator performs
 * cross-field structural checks only — it trusts that per-field meta shapes
 * are already well-formed.
 */
export const validateFieldVisibility = (input: {
  fields: ValidatableField[];
}): { ok: true } | { ok: false; errors: FieldVisibilityError[] } => {
  const errors: FieldVisibilityError[] = [];
  const byStableId = new Map<string, ValidatableField>();
  for (const f of input.fields) {
    const sid = extractStableId(f);
    if (sid) byStableId.set(sid, f);
  }

  for (const dep of input.fields) {
    const block = extractVisibility(dep);
    if (!block) continue;

    const depStableId = extractStableId(dep);

    block.rules.forEach((rule, ruleIndex) => {
      const trigger = byStableId.get(rule.triggerFieldStableId);

      if (depStableId !== null && rule.triggerFieldStableId === depStableId) {
        errors.push({
          fieldId: dep.id,
          ruleIndex,
          code: 'FIELD_VISIBILITY_SELF_REFERENCE',
          message: 'A field cannot reference itself as a visibility trigger.',
        });
        return;
      }

      if (!trigger) {
        errors.push({
          fieldId: dep.id,
          ruleIndex,
          code: 'FIELD_VISIBILITY_TRIGGER_NOT_FOUND',
          message: `Trigger field with stableId "${rule.triggerFieldStableId}" not found.`,
        });
        return;
      }

      if (trigger.recipientId !== dep.recipientId) {
        errors.push({
          fieldId: dep.id,
          ruleIndex,
          code: 'FIELD_VISIBILITY_CROSS_RECIPIENT',
          message: 'Visibility trigger must be on the same recipient as the dependent field.',
        });
        return;
      }

      if (!ELIGIBLE_TRIGGER_TYPES.has(trigger.type)) {
        errors.push({
          fieldId: dep.id,
          ruleIndex,
          code: 'FIELD_VISIBILITY_TRIGGER_INELIGIBLE',
          message: `Trigger field type ${trigger.type} cannot be used. Eligible types: RADIO, CHECKBOX, DROPDOWN, TEXT.`,
        });
        return;
      }

      if (
        (trigger.type === FieldType.RADIO ||
          trigger.type === FieldType.CHECKBOX ||
          trigger.type === FieldType.DROPDOWN) &&
        (rule.operator === 'equals' ||
          rule.operator === 'notEquals' ||
          rule.operator === 'contains' ||
          rule.operator === 'notContains')
      ) {
        const allowed = triggerOptionValues(trigger);
        if (allowed && rule.value !== undefined && !allowed.includes(rule.value)) {
          errors.push({
            fieldId: dep.id,
            ruleIndex,
            code: 'FIELD_VISIBILITY_VALUE_INVALID',
            message: `Value "${rule.value}" is not among the trigger's defined options.`,
          });
        }
      }
    });
  }

  // Cycle detection across all fields that have a visibility block.
  const relevantIds = input.fields
    .filter((f) => extractVisibility(f) !== null)
    .map((f) => String(f.id));
  const byId = new Map(input.fields.map((f) => [String(f.id), f] as const));

  const dependenciesOf = (idStr: string) => {
    const f = byId.get(idStr);
    if (!f) return [];
    const v = extractVisibility(f);
    if (!v) return [];
    return v.rules
      .map((r) => byStableId.get(r.triggerFieldStableId))
      .filter((t): t is ValidatableField => !!t)
      .map((t) => String(t.id));
  };

  const sorted = topologicalSort(relevantIds, dependenciesOf);
  if (sorted.kind === 'cycle') {
    const pathFields = sorted.path
      .map((idStr) => byId.get(idStr))
      .filter(Boolean) as ValidatableField[];
    for (const f of pathFields) {
      errors.push({
        fieldId: f.id,
        ruleIndex: null,
        code: 'FIELD_VISIBILITY_CYCLE',
        message: `Visibility rule would create a circular dependency: ${sorted.path.join(' → ')}.`,
        cyclePath: sorted.path,
      });
    }
  }

  return errors.length === 0 ? { ok: true } : { ok: false, errors };
};
