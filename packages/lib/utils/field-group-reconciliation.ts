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
   * field and its radio selection wins any conflict. Typically the field which was just
   * edited, or an existing field when a new field joins the group.
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
 * 3. If the group is still invalid (e.g. a checkbox rule which the pooled options no
 *    longer satisfy), removes the validation rule from every field.
 */
export const reconcileFieldGroup = <T extends FieldGroupItem & { formId: string }>({
  groupId,
  items,
  sourceFormId,
}: ReconcileFieldGroupOptions<T>): ReconcileFieldGroupResult<T> => {
  if (items.length === 0) {
    return { updates: [], isValidationRemoved: false };
  }

  const initialEntries: ReconciledFieldGroupItem<T>[] = items.map((item) => ({
    item,
    fieldMeta: parseFieldMetaOrDefault(item.type, item.fieldMeta),
  }));

  const syncedEntries = syncFieldGroupSharedMeta(initialEntries, sourceFormId);
  const radioResolvedEntries = resolveFieldGroupRadioConflicts(syncedEntries, sourceFormId);

  const { entries: reconciledEntries, isValidationRemoved } = removeInvalidFieldGroupValidation(
    groupId,
    radioResolvedEntries,
  );

  const updates = reconciledEntries.filter(
    ({ item, fieldMeta }) => !isDeepEqual(parseFieldMetaOrDefault(item.type, item.fieldMeta), fieldMeta),
  );

  return { updates, isValidationRemoved };
};

/**
 * Removes the validation rule from a field's meta. Only checkbox fields currently carry a
 * group level validation rule, which is removed when the group no longer satisfies it.
 */
export const removeFieldGroupValidation = (type: FieldType, fieldMeta: unknown): TFieldMetaSchema => {
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
 * Copies the shared meta from the source field to every other field.
 */
const syncFieldGroupSharedMeta = <T extends FieldGroupItem & { formId: string }>(
  entries: ReconciledFieldGroupItem<T>[],
  sourceFormId?: string,
): ReconciledFieldGroupItem<T>[] => {
  const source = entries.find((entry) => entry.item.formId === sourceFormId);

  if (!source) {
    return entries;
  }

  return entries.map((entry) =>
    entry.item.formId === source.item.formId
      ? entry
      : { ...entry, fieldMeta: mergeFieldGroupSharedMeta(entry.item.type, entry.fieldMeta, source.fieldMeta) },
  );
};

/**
 * Ensures at most one radio option is checked across the group. The source field wins,
 * otherwise the first checked field does.
 */
const resolveFieldGroupRadioConflicts = <T extends FieldGroupItem & { formId: string }>(
  entries: ReconciledFieldGroupItem<T>[],
  sourceFormId?: string,
): ReconciledFieldGroupItem<T>[] => {
  const checkedEntries = entries.filter((entry) => hasCheckedRadioValue(entry.fieldMeta));

  if (checkedEntries.length <= 1) {
    return entries;
  }

  const winner = checkedEntries.find((entry) => entry.item.formId === sourceFormId) ?? checkedEntries[0];

  return entries.map((entry) =>
    entry.item.formId === winner.item.formId
      ? entry
      : { ...entry, fieldMeta: clearRadioFieldMetaCheckedValues(entry.fieldMeta) },
  );
};

/**
 * Removes the validation rule from every field if the group is invalid and doing so
 * makes it valid. Groups which are invalid for other reasons are returned untouched.
 */
const removeInvalidFieldGroupValidation = <T extends FieldGroupItem & { formId: string }>(
  groupId: string,
  entries: ReconciledFieldGroupItem<T>[],
): { entries: ReconciledFieldGroupItem<T>[]; isValidationRemoved: boolean } => {
  if (validateFieldGroup(groupId, toFieldGroupItems(entries)).length === 0) {
    return { entries, isValidationRemoved: false };
  }

  const entriesWithoutValidation = entries.map((entry) => ({
    ...entry,
    fieldMeta: removeFieldGroupValidation(entry.item.type, entry.fieldMeta),
  }));

  if (validateFieldGroup(groupId, toFieldGroupItems(entriesWithoutValidation)).length > 0) {
    return { entries, isValidationRemoved: false };
  }

  return { entries: entriesWithoutValidation, isValidationRemoved: true };
};

const toFieldGroupItems = <T extends FieldGroupItem>(entries: ReconciledFieldGroupItem<T>[]): T[] => {
  return entries.map(({ item, fieldMeta }) => ({ ...item, fieldMeta }));
};

const hasCheckedRadioValue = (fieldMeta: TFieldMetaSchema): boolean => {
  return fieldMeta?.type === 'radio' && (fieldMeta.values ?? []).some((value) => value.checked);
};

const clearRadioFieldMetaCheckedValues = (fieldMeta: TFieldMetaSchema): TFieldMetaSchema => {
  if (!fieldMeta || fieldMeta.type !== 'radio' || !fieldMeta.values) {
    return fieldMeta;
  }

  return {
    ...fieldMeta,
    values: fieldMeta.values.map((value) => ({ ...value, checked: false })),
  };
};
