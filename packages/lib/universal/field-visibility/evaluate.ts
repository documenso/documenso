import { FieldType } from '@prisma/client';

import type { TVisibilityBlock, TVisibilityRule } from '../../types/field-meta';
import { topologicalSort } from './topological-sort';

export type EvaluatableField = {
  id: number;
  type: FieldType;
  customText: string;
  inserted: boolean;
  fieldMeta: unknown;
};

const getStableId = (field: EvaluatableField): string | null => {
  const meta = field.fieldMeta as { stableId?: unknown } | null;
  return meta && typeof meta.stableId === 'string' ? meta.stableId : null;
};

const getVisibility = (field: EvaluatableField): TVisibilityBlock | null => {
  const meta = field.fieldMeta as { visibility?: TVisibilityBlock } | null;
  return meta?.visibility ?? null;
};

const normalize = (s: string): string => s.trim().toLowerCase();

// Returns [] on malformed JSON — safe for contains/isEmpty (fail-closed)
// but note that notContains will treat corrupt state as "does not contain X" → true.
const parseCheckboxCustomText = (customText: string): string[] => {
  if (!customText) return [];
  try {
    const parsed = JSON.parse(customText);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
};

/**
 * Resolve the current "value" the rule sees for a trigger field.
 * - For checkbox: list of checked option VALUES (not ids).
 * - For everything else: trigger.customText (empty string if not inserted).
 */
const triggerValueFor = (
  trigger: EvaluatableField,
): { isEmpty: boolean; scalar: string; list: string[] } => {
  if (!trigger.inserted) return { isEmpty: true, scalar: '', list: [] };

  if (trigger.type === FieldType.CHECKBOX) {
    const selectedIds = parseCheckboxCustomText(trigger.customText);
    const meta = trigger.fieldMeta as { values?: Array<{ id: number; value: string }> } | null;
    const byId = new Map((meta?.values ?? []).map((v) => [String(v.id), v.value]));
    const list = selectedIds.map((id) => byId.get(id) ?? id);
    return { isEmpty: list.length === 0, scalar: '', list };
  }

  const scalar = trigger.customText;
  return { isEmpty: scalar.trim() === '', scalar, list: [] };
};

const evaluateRule = (rule: TVisibilityRule, trigger: EvaluatableField | null): boolean => {
  if (!trigger) return false; // fail-closed
  const v = triggerValueFor(trigger);

  switch (rule.operator) {
    case 'isEmpty':
      return v.isEmpty;
    case 'isNotEmpty':
      return !v.isEmpty;
    case 'equals':
      return normalize(v.scalar) === normalize(rule.value);
    case 'notEquals':
      return normalize(v.scalar) !== normalize(rule.value);
    case 'contains':
      if (trigger.type === FieldType.CHECKBOX) {
        return v.list.map(normalize).includes(normalize(rule.value));
      }
      return normalize(v.scalar).includes(normalize(rule.value));
    case 'notContains':
      if (trigger.type === FieldType.CHECKBOX) {
        return !v.list.map(normalize).includes(normalize(rule.value));
      }
      return !normalize(v.scalar).includes(normalize(rule.value));
    default:
      return false;
  }
};

export const evaluateVisibility = (
  field: EvaluatableField,
  siblings: EvaluatableField[],
): { visible: boolean } => {
  const block = getVisibility(field);
  if (!block) return { visible: true };

  const siblingsByStableId = new Map<string, EvaluatableField>();
  for (const s of siblings) {
    const sid = getStableId(s);
    if (sid) siblingsByStableId.set(sid, s);
  }

  const checks = block.rules.map((rule) =>
    evaluateRule(rule, siblingsByStableId.get(rule.triggerFieldStableId) ?? null),
  );

  return {
    visible: block.match === 'all' ? checks.every(Boolean) : checks.some(Boolean),
  };
};

/**
 * Evaluates all fields for a single recipient. Topologically orders by
 * dependency so a chained dependent's visibility considers its trigger's state
 * (the trigger's VALUE always counts, even if the trigger is itself hidden —
 * hidden triggers with a pre-commit value will be cleared at completion; for
 * the moment, their customText is the source of truth).
 */
export const evaluateAllVisibility = (fields: EvaluatableField[]): Map<number, boolean> => {
  const result = new Map<number, boolean>();

  const byStableId = new Map<string, EvaluatableField>();
  for (const f of fields) {
    const sid = getStableId(f);
    if (sid) byStableId.set(sid, f);
  }

  const ids = fields.map((f) => String(f.id));
  const byId = new Map(fields.map((f) => [String(f.id), f] as const));

  const dependenciesOf = (idStr: string) => {
    const field = byId.get(idStr);
    if (!field) return [];
    const block = getVisibility(field);
    if (!block) return [];
    return block.rules
      .map((r) => byStableId.get(r.triggerFieldStableId))
      .filter((f): f is EvaluatableField => !!f)
      .map((f) => String(f.id));
  };

  const sorted = topologicalSort(ids, dependenciesOf);

  if (sorted.kind === 'cycle') {
    for (const f of fields) result.set(f.id, false);
    return result;
  }

  for (const idStr of sorted.order) {
    const field = byId.get(idStr);
    if (!field) continue;
    const { visible } = evaluateVisibility(field, fields);
    result.set(field.id, visible);
  }

  return result;
};
