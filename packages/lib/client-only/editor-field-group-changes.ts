import { isDeepEqual } from 'remeda';

import { reconcileFieldGroup } from '../utils/field-group-reconciliation';
import type { TLocalField } from './hooks/use-editor-fields';

export type EditorFieldUpdates = Partial<Omit<TLocalField, 'formId'>>;

export type EditorFieldUpdate = {
  formId: string;
  updates: EditorFieldUpdates;
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
 * Keeps every field group valid and consistent after a change in the editor.
 *
 * Returns the updated fields, plus the groups whose validation rule had to be removed so
 * the user can be told.
 */
export const resolveEditorFieldGroupChanges = ({
  previousFields,
  nextFields: requestedNextFields,
  changedFormIds,
}: ResolveEditorFieldGroupChangesOptions): ResolveEditorFieldGroupChangesResult => {
  const previousFieldsByFormId = new Map(previousFields.map((field) => [field.formId, field]));

  const getPreviousGroupId = (formId: string) => previousFieldsByFormId.get(formId)?.groupId ?? null;

  // Step 1: Block invalid joins.
  // Every field in a group must have the same type and recipient. A field that tries to
  // join a group it doesn't match stays in the group it was in before.
  const isJoiningGroup = (field: TLocalField) =>
    Boolean(field.groupId) && field.groupId !== getPreviousGroupId(field.formId);

  // The fields already in a group decide what matches it. For a brand new group, the
  // first field to join decides.
  const existingGroupFields = requestedNextFields.filter((field) => field.groupId && !isJoiningGroup(field));
  const referenceFieldByGroupId = new Map<string, TLocalField>();

  for (const field of [...existingGroupFields, ...requestedNextFields]) {
    if (field.groupId && !referenceFieldByGroupId.has(field.groupId)) {
      referenceFieldByGroupId.set(field.groupId, field);
    }
  }

  const nextFields = requestedNextFields.map((field) => {
    if (!field.groupId || !isJoiningGroup(field)) {
      return field;
    }

    const referenceField = referenceFieldByGroupId.get(field.groupId);

    if (referenceField?.type === field.type && referenceField.recipientId === field.recipientId) {
      return field;
    }

    return { ...field, groupId: getPreviousGroupId(field.formId) };
  });

  // Step 2: find the groups this change touched. That's any group a changed or deleted
  // field was in, and any group a changed or new field is in now.
  const nextFieldsByFormId = new Map(nextFields.map((field) => [field.formId, field]));
  const affectedGroupIds = new Set<string>();

  for (const previousField of previousFields) {
    const isRemoved = !nextFieldsByFormId.has(previousField.formId);
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

  const reconciledMetaByFormId = new Map<string, TLocalField['fieldMeta']>();
  const validationRemovedGroupIds = new Set<string>();

  const reconcile = (groupId: string, items: TLocalField[], sourceFormId?: string) => {
    const { updates, isValidationRemoved } = reconcileFieldGroup({ groupId, items, sourceFormId });

    for (const { item, fieldMeta } of updates) {
      reconciledMetaByFormId.set(item.formId, fieldMeta);
    }

    if (isValidationRemoved) {
      validationRemovedGroupIds.add(groupId);
    }
  };

  // Step 3: bring each touched group back in sync by copying settings from one field
  // (the "source") to the rest of the group.
  for (const groupId of affectedGroupIds) {
    const items = nextFields.filter((field) => field.groupId === groupId);

    const wasInGroup = (field: TLocalField) => getPreviousGroupId(field.formId) === groupId;

    const editedField = items.find(
      (field) =>
        changedFormIds.has(field.formId) &&
        wasInGroup(field) &&
        !isDeepEqual(previousFieldsByFormId.get(field.formId)?.fieldMeta, field.fieldMeta),
    );

    const hasJoiningField = items.some((field) => changedFormIds.has(field.formId) && !wasInGroup(field));

    let sourceFormId = editedField?.formId;

    if (!sourceFormId && hasJoiningField) {
      sourceFormId = items.find(wasInGroup)?.formId;
    }

    reconcile(groupId, items, sourceFormId);
  }

  // Step 4: check fields that just left a group on their own.
  // A group's rule, such as "select at least 2", counts options across all of its fields.
  // A field that leaves is saved and validated by itself, so if it can't meet the rule
  // alone, the rule is removed from it. Otherwise every save would fail.
  for (const field of nextFields) {
    const previousGroupId = getPreviousGroupId(field.formId);

    if (changedFormIds.has(field.formId) && previousGroupId && !field.groupId) {
      reconcile(previousGroupId, [field]);
    }
  }

  const reconciledFields = nextFields.map((field) => {
    if (!reconciledMetaByFormId.has(field.formId)) {
      return field;
    }

    return { ...field, fieldMeta: reconciledMetaByFormId.get(field.formId) };
  });

  return { reconciledFields, validationRemovedGroupIds: Array.from(validationRemovedGroupIds) };
};
