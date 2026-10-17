import type { FieldType } from '@prisma/client';
import { isDeepEqual } from 'remeda';

import type { TFieldMetaSchema } from '../types/field-meta';
import {
  type FieldGroupMember,
  mergeFieldGroupSharedMeta,
  parseFieldMetaOrDefault,
  validateFieldGroup,
} from './field-groups';

/**
 * A group member paired with the meta it should have after reconciliation.
 */
type ReconciledFieldGroupMember<T> = {
  member: T;
  fieldMeta: TFieldMetaSchema;
};

export type ReconcileFieldGroupOptions<T extends FieldGroupMember & { formId: string }> = {
  groupId: string;
  /**
   * The final membership of the group.
   */
  members: T[];
  /**
   * The member whose values take precedence. Its shared meta is copied to every other
   * member and its radio selection wins any conflict. Typically the member which was just
   * edited, or an existing member when a new field joins the group.
   */
  sourceFormId?: string;
};

export type ReconcileFieldGroupResult<T> = {
  /**
   * Members whose meta must change for the group to be valid and in sync.
   */
  updates: ReconciledFieldGroupMember<T>[];
  /**
   * Whether the validation rule had to be removed from the group to keep it valid.
   */
  isValidationRemoved: boolean;
};

/**
 * Brings a group into a valid, in sync state after any change to its membership or to
 * one of its members.
 *
 * 1. Copies the shared meta from the source member to every other member.
 * 2. Ensures at most one radio option is checked across the group.
 * 3. If the group is still invalid (e.g. a checkbox rule which the pooled options no
 *    longer satisfy), removes the validation rule from every member.
 */
export const reconcileFieldGroup = <T extends FieldGroupMember & { formId: string }>({
  groupId,
  members,
  sourceFormId,
}: ReconcileFieldGroupOptions<T>): ReconcileFieldGroupResult<T> => {
  if (members.length === 0) {
    return { updates: [], isValidationRemoved: false };
  }

  const initialEntries: ReconciledFieldGroupMember<T>[] = members.map((member) => ({
    member,
    fieldMeta: parseFieldMetaOrDefault(member.type, member.fieldMeta),
  }));

  const syncedEntries = syncFieldGroupSharedMeta(initialEntries, sourceFormId);
  const radioResolvedEntries = resolveFieldGroupRadioConflicts(syncedEntries, sourceFormId);

  const { entries: reconciledEntries, isValidationRemoved } = removeInvalidFieldGroupValidation(
    groupId,
    radioResolvedEntries,
  );

  const updates = reconciledEntries.filter(
    ({ member, fieldMeta }) => !isDeepEqual(parseFieldMetaOrDefault(member.type, member.fieldMeta), fieldMeta),
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
 * Copies the shared meta from the source member to every other member.
 */
const syncFieldGroupSharedMeta = <T extends FieldGroupMember & { formId: string }>(
  entries: ReconciledFieldGroupMember<T>[],
  sourceFormId?: string,
): ReconciledFieldGroupMember<T>[] => {
  const source = entries.find((entry) => entry.member.formId === sourceFormId);

  if (!source) {
    return entries;
  }

  return entries.map((entry) =>
    entry.member.formId === source.member.formId
      ? entry
      : { ...entry, fieldMeta: mergeFieldGroupSharedMeta(entry.member.type, entry.fieldMeta, source.fieldMeta) },
  );
};

/**
 * Ensures at most one radio option is checked across the group. The source member wins,
 * otherwise the first checked member does.
 */
const resolveFieldGroupRadioConflicts = <T extends FieldGroupMember & { formId: string }>(
  entries: ReconciledFieldGroupMember<T>[],
  sourceFormId?: string,
): ReconciledFieldGroupMember<T>[] => {
  const checkedEntries = entries.filter((entry) => hasCheckedRadioValue(entry.fieldMeta));

  if (checkedEntries.length <= 1) {
    return entries;
  }

  const winner = checkedEntries.find((entry) => entry.member.formId === sourceFormId) ?? checkedEntries[0];

  return entries.map((entry) =>
    entry.member.formId === winner.member.formId
      ? entry
      : { ...entry, fieldMeta: clearRadioFieldMetaCheckedValues(entry.fieldMeta) },
  );
};

/**
 * Removes the validation rule from every member if the group is invalid and doing so
 * makes it valid. Groups which are invalid for other reasons are returned untouched.
 */
const removeInvalidFieldGroupValidation = <T extends FieldGroupMember & { formId: string }>(
  groupId: string,
  entries: ReconciledFieldGroupMember<T>[],
): { entries: ReconciledFieldGroupMember<T>[]; isValidationRemoved: boolean } => {
  if (validateFieldGroup(groupId, toFieldGroupMembers(entries)).length === 0) {
    return { entries, isValidationRemoved: false };
  }

  const entriesWithoutValidation = entries.map((entry) => ({
    ...entry,
    fieldMeta: removeFieldGroupValidation(entry.member.type, entry.fieldMeta),
  }));

  if (validateFieldGroup(groupId, toFieldGroupMembers(entriesWithoutValidation)).length > 0) {
    return { entries, isValidationRemoved: false };
  }

  return { entries: entriesWithoutValidation, isValidationRemoved: true };
};

const toFieldGroupMembers = <T extends FieldGroupMember>(entries: ReconciledFieldGroupMember<T>[]): T[] => {
  return entries.map(({ member, fieldMeta }) => ({ ...member, fieldMeta }));
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
