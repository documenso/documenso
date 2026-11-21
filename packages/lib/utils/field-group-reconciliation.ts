import type { FieldType } from '@prisma/client';
import { isDeepEqual } from 'remeda';

import type { TFieldMetaSchema } from '../types/field-meta';
import {
  type FieldGroupItem,
  mergeFieldGroupSharedMeta,
  parseFieldMetaOrDefault,
  validateFieldGroup,
} from './field-groups';

/**
 * A group field paired with the meta it should have after reconciliation.
 */
type ReconciledFieldGroupItem<T> = {
  item: T;
  fieldMeta: TFieldMetaSchema;
};

export type ReconcileFieldGroupOptions<T extends FieldGroupItem & { formId: string }> = {
  groupId: string;
  /**
   * Every field in the group after the change.
   */
  items: T[];
  /**
   * The field whose values take precedence. Its shared meta is copied to every other
   * field and its radio selection wins any conflict.
   */
  sourceFormId?: string;
};

export type ReconcileFieldGroupResult<T> = {
  /**
   * Fields whose meta must change for the group to be valid and in sync.
   */
  updates: ReconciledFieldGroupItem<T>[];
  /**
   * Whether the validation rule had to be removed from the group to keep it valid.
   */
  isValidationRemoved: boolean;
};

/**
 * Brings a group into a valid, in sync state after a field joins or leaves it, or one of
 * its fields changes.
 *
 * 1. Copies the shared meta from the source field to every other field.
 * 2. Ensures at most one radio option is checked across the group.
 * 3. If the group is still invalid (e.g. a checkbox rule which the options across the
 *    group no longer satisfy), removes the validation rule from every field.
 */
export const reconcileFieldGroup = <T extends FieldGroupItem & { formId: string }>({
  groupId,
  items,
  sourceFormId,
}: ReconcileFieldGroupOptions<T>): ReconcileFieldGroupResult<T> => {
  let entries: ReconciledFieldGroupItem<T>[] = items.map((item) => ({
    item,
    fieldMeta: parseFieldMetaOrDefault(item.type, item.fieldMeta),
  }));

  const sourceEntry = entries.find((entry) => entry.item.formId === sourceFormId);

  // 1. Copy the shared meta from the source field to every other field.
  if (sourceEntry) {
    for (const entry of entries) {
      if (entry !== sourceEntry) {
        entry.fieldMeta = mergeFieldGroupSharedMeta(entry.item.type, entry.fieldMeta, sourceEntry.fieldMeta);
      }
    }
  }

  // 2. Keep a single radio selection across the group. The source field's selection wins,
  // otherwise the first one does.
  const checkedRadioEntries = entries.filter(
    ({ fieldMeta }) => fieldMeta?.type === 'radio' && fieldMeta.values?.some((value) => value.checked),
  );

  if (checkedRadioEntries.length > 1) {
    const keptEntry = checkedRadioEntries.find((entry) => entry === sourceEntry) ?? checkedRadioEntries[0];

    for (const entry of checkedRadioEntries) {
      if (entry !== keptEntry && entry.fieldMeta?.type === 'radio' && entry.fieldMeta.values) {
        entry.fieldMeta = {
          ...entry.fieldMeta,
          values: entry.fieldMeta.values.map((value) => ({ ...value, checked: false })),
        };
      }
    }
  }

  // 3. Remove the validation rule if that is what makes the group invalid. A group which is
  // invalid for another reason is left untouched.
  const isGroupValid = (candidateEntries: ReconciledFieldGroupItem<T>[]) => {
    const groupItems = candidateEntries.map(({ item, fieldMeta }) => ({ ...item, fieldMeta }));

    return validateFieldGroup(groupId, groupItems).length === 0;
  };

  let isValidationRemoved = false;

  if (!isGroupValid(entries)) {
    const entriesWithoutValidation = entries.map((entry) => ({
      ...entry,
      fieldMeta: removeFieldGroupValidation(entry.item.type, entry.fieldMeta),
    }));

    if (isGroupValid(entriesWithoutValidation)) {
      entries = entriesWithoutValidation;
      isValidationRemoved = true;
    }
  }

  const updates = entries.filter(
    ({ item, fieldMeta }) => !isDeepEqual(parseFieldMetaOrDefault(item.type, item.fieldMeta), fieldMeta),
  );

  return { updates, isValidationRemoved };
};

/**
 * Removes the validation rule from a field's meta. Only checkbox fields currently carry a
 * group level validation rule, which is removed when the group no longer satisfies it.
 */
export const removeFieldGroupValidation = (type: FieldType, fieldMeta: TFieldMetaSchema | null): TFieldMetaSchema => {
  const baseMeta = parseFieldMetaOrDefault(type, fieldMeta);

  if (!baseMeta || baseMeta.type !== 'checkbox') {
    return baseMeta;
  }

  return {
    ...baseMeta,
    validationRule: undefined,
    validationLength: undefined,
  };
};

/**
 * Whether a field's meta carries a rule which counts across its whole group. Only
 * checkbox fields currently do.
 */
export const hasFieldGroupValidation = (fieldMeta: TFieldMetaSchema | null | undefined): boolean => {
  return fieldMeta?.type === 'checkbox' && Boolean(fieldMeta.validationRule);
};

export type ReconcileFieldGroupsAfterRemovalOptions<T extends FieldGroupItem & { id: number }> = {
  /**
   * The fields which are left. Fields outside the affected groups are ignored.
   */
  remainingFields: T[];
  /**
   * The groups to check, which need to include every group which lost a field.
   */
  groupIds: Iterable<string>;
};

/**
 * Keeps groups valid after some of their fields were removed by something other than a
 * field edit, such as a deleted file or a PDF replaced by a shorter one. A group left
 * with a rule it can no longer satisfy has the rule removed, the same as when its field
 * is deleted in the editor.
 *
 * Returns the new meta for every field which must change, keyed by field ID.
 */
export const reconcileFieldGroupsAfterRemoval = <T extends FieldGroupItem & { id: number }>({
  remainingFields,
  groupIds,
}: ReconcileFieldGroupsAfterRemovalOptions<T>): Map<number, TFieldMetaSchema> => {
  const fieldMetaByFieldId = new Map<number, TFieldMetaSchema>();

  for (const groupId of new Set(groupIds)) {
    const items = remainingFields
      .filter((field) => field.groupId === groupId)
      .map((field) => ({ ...field, formId: String(field.id) }));

    const { updates } = reconcileFieldGroup({ groupId, items });

    for (const { item, fieldMeta } of updates) {
      // Dropping the keys which were set to undefined makes the result identical to what
      // is read back once stored as JSON.
      fieldMetaByFieldId.set(item.id, parseFieldMetaOrDefault(item.type, JSON.parse(JSON.stringify(fieldMeta))));
    }
  }

  return fieldMetaByFieldId;
};
