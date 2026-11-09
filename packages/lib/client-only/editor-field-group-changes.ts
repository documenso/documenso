import { isDeepEqual } from 'remeda';

import { reconcileFieldGroup } from '../utils/field-group-reconciliation';
import type { TLocalField } from './hooks/use-editor-fields';

export type EditorFieldUpdate = {
  formId: string;
  updates: Partial<TLocalField>;
};

export type EditorFieldChanges = {
  fieldUpdates?: EditorFieldUpdate[];
  newFields?: TLocalField[];
  removedFormIds?: string[];
};

export type ResolveEditorFieldGroupChangesOptions = {
  previousFields: TLocalField[];
  nextFields: TLocalField[];
  /**
   * Form IDs of the fields which were updated or created.
   */
  changedFormIds: Set<string>;
};

export type ResolveEditorFieldGroupChangesResult = {
  reconciledFields: TLocalField[];
  /**
   * Groups which had their validation rule removed to remain valid.
   */
  validationRemovedGroupIds: string[];
};

/**
 * Applies an update to a local field.
 *
 * A grouped field which changes type or recipient always leaves its group, since groups
 * must share a single type and recipient.
 */
export const applyEditorFieldUpdate = (field: TLocalField, updates: Partial<TLocalField>): TLocalField => {
  const updatedField = {
    ...field,
    ...updates,
  };

  const hasTypeChanged = updates.type !== undefined && updates.type !== field.type;
  const hasRecipientChanged = updates.recipientId !== undefined && updates.recipientId !== field.recipientId;

  const isLeavingGroup = Boolean(updatedField.groupId) && (hasTypeChanged || hasRecipientChanged);

  if (isLeavingGroup) {
    updatedField.groupId = null;
  }

  return {
    ...updatedField,
    ...restrictFieldPosValues(updatedField),
  };
};

/**
 * Reconciles every group affected by a change so that groups are always valid and in
 * sync after any local write.
 *
 * - A field whose meta was edited becomes the source of truth for its group.
 * - A field which joined a group adopts the meta of an existing field.
 * - Fields left behind in a group (after a field leaves or is removed) are only
 *   validated, with the validation rule removed if the group is no longer valid.
 */
export const resolveEditorFieldGroupChanges = ({
  previousFields,
  nextFields,
  changedFormIds,
}: ResolveEditorFieldGroupChangesOptions): ResolveEditorFieldGroupChangesResult => {
  const previousFieldsByFormId = new Map(previousFields.map((field) => [field.formId, field]));

  const affectedGroupIds = resolveAffectedGroupIds({ previousFields, nextFields, changedFormIds });

  const reconciledMetaByFormId = new Map<string, TLocalField['fieldMeta']>();
  const validationRemovedGroupIds: string[] = [];

  for (const groupId of affectedGroupIds) {
    const items = nextFields.filter((field) => field.groupId === groupId);

    if (items.length === 0) {
      continue;
    }

    const sourceFormId = resolveFieldGroupSourceFormId({ groupId, items, previousFieldsByFormId, changedFormIds });

    const { updates, isValidationRemoved } = reconcileFieldGroup({ groupId, items, sourceFormId });

    for (const { item, fieldMeta } of updates) {
      reconciledMetaByFormId.set(item.formId, fieldMeta);
    }

    if (isValidationRemoved) {
      validationRemovedGroupIds.push(groupId);
    }
  }

  const reconciledFields = nextFields.map((field) =>
    reconciledMetaByFormId.has(field.formId)
      ? { ...field, fieldMeta: reconciledMetaByFormId.get(field.formId) }
      : field,
  );

  return { reconciledFields, validationRemovedGroupIds };
};

/**
 * Every group which gained, lost, or had a field changed.
 */
const resolveAffectedGroupIds = ({
  previousFields,
  nextFields,
  changedFormIds,
}: ResolveEditorFieldGroupChangesOptions): Set<string> => {
  const affectedGroupIds = new Set<string>();

  const nextFieldsByFormId = new Map(nextFields.map((field) => [field.formId, field]));

  for (const previousField of previousFields) {
    const nextField = nextFieldsByFormId.get(previousField.formId);

    const isRemoved = nextField === undefined;
    const isChanged = changedFormIds.has(previousField.formId);

    if (previousField.groupId && (isRemoved || isChanged)) {
      affectedGroupIds.add(previousField.groupId);
    }
  }

  for (const formId of changedFormIds) {
    const nextGroupId = nextFieldsByFormId.get(formId)?.groupId;

    if (nextGroupId) {
      affectedGroupIds.add(nextGroupId);
    }
  }

  return affectedGroupIds;
};

type ResolveFieldGroupSourceFormIdOptions = {
  groupId: string;
  items: TLocalField[];
  previousFieldsByFormId: Map<string, TLocalField>;
  changedFormIds: Set<string>;
};

/**
 * Works out which field in a group should act as the source of truth for reconciliation.
 *
 * An edited field takes precedence. Otherwise, when a field joins the group, an existing
 * field is used so the joining field adopts the group's meta. Returns undefined when the
 * group only needs validating.
 */
const resolveFieldGroupSourceFormId = ({
  groupId,
  items,
  previousFieldsByFormId,
  changedFormIds,
}: ResolveFieldGroupSourceFormIdOptions): string | undefined => {
  const wasInGroup = (item: TLocalField) => previousFieldsByFormId.get(item.formId)?.groupId === groupId;

  const isEditedItem = (item: TLocalField) => {
    if (!changedFormIds.has(item.formId) || !wasInGroup(item)) {
      return false;
    }

    const previousField = previousFieldsByFormId.get(item.formId);

    return !isDeepEqual(previousField?.fieldMeta, item.fieldMeta);
  };

  const isJoiningItem = (item: TLocalField) => changedFormIds.has(item.formId) && !wasInGroup(item);

  const editedItem = items.find(isEditedItem);

  if (editedItem) {
    return editedItem.formId;
  }

  if (items.some(isJoiningItem)) {
    return items.find(wasInGroup)?.formId;
  }

  return undefined;
};

const restrictFieldPosValues = (field: Pick<TLocalField, 'positionX' | 'positionY' | 'width' | 'height'>) => {
  return {
    positionX: Math.max(0, Math.min(100, field.positionX)),
    positionY: Math.max(0, Math.min(100, field.positionY)),
    width: Math.max(0, Math.min(100, field.width)),
    height: Math.max(0, Math.min(100, field.height)),
  };
};

export { restrictFieldPosValues };
