import type { TEditorEnvelope } from '@documenso/lib/types/envelope-editor';
import { type TFieldMetaSchema, ZFieldMetaSchema } from '@documenso/lib/types/field-meta';
import {
  hasFieldGroupValidation,
  reconcileFieldGroupsAfterRemoval,
} from '@documenso/lib/utils/field-group-reconciliation';
import { clampPercentageBox } from '@documenso/lib/utils/geometry';
import { useToast } from '@documenso/ui/primitives/use-toast';
import { useLingui } from '@lingui/react/macro';
import type { Field } from '@prisma/client';
import { FieldType } from '@prisma/client';
import { useCallback, useMemo, useState } from 'react';
import { isDeepEqual } from 'remeda';
import { z } from 'zod';
import { EDITOR_DUPLICATE_ITEM_OFFSET } from '../../constants/envelope-editor';
import {
  type EditorFieldChanges,
  type EditorFieldUpdate,
  type EditorFieldUpdates,
  resolveEditorFieldGroupChanges,
} from '../editor-field-group-changes';
import { createLocalFormId, getOtherPageNumbers, useEditorFormArray } from './use-editor-form-array';

export const ZLocalFieldSchema = z.object({
  // This is the actual ID of the field if created.
  id: z.number().optional(),
  // This is the local client side ID of the field.
  formId: z.string().min(1),
  // This is the ID of the envelope item to put the field on.
  envelopeItemId: z.string(),
  type: z.nativeEnum(FieldType),
  recipientId: z.number(),
  page: z.number().min(1),
  positionX: z.number().min(0),
  positionY: z.number().min(0),
  width: z.number().min(0),
  height: z.number().min(0),
  fieldMeta: ZFieldMetaSchema,
  groupId: z.string().max(255).nullish(),
  externalId: z.string().max(255).nullish(),
});

export type TLocalField = z.infer<typeof ZLocalFieldSchema>;

type EditorFieldsProps = {
  envelope: TEditorEnvelope;

  handleFieldsUpdate: (getFields: () => TLocalField[]) => unknown;
};

type UseEditorFieldsResponse = {
  localFields: TLocalField[];

  // Selected field
  selectedField: TLocalField | undefined;
  setSelectedField: (formId: string | null) => void;

  // Field operations
  addField: (field: Omit<TLocalField, 'formId'>) => TLocalField;
  setFieldId: (formId: string, id: number) => void;
  removeFieldsByFormId: (formIds: string[]) => void;
  updateFieldByFormId: (formId: string, updates: EditorFieldUpdates) => void;
  updateFieldsByFormId: (fieldUpdates: EditorFieldUpdate[]) => void;
  duplicateField: (field: TLocalField) => TLocalField;
  duplicateFieldToAllPages: (field: TLocalField) => TLocalField[];

  // Field utilities
  getFieldByFormId: (formId: string) => TLocalField | undefined;
  getFieldMetaRewriteCount: (formId: string) => number;

  // Selected recipient
  selectedRecipient: TEditorEnvelope['recipients'][number] | null;
  setSelectedRecipient: (recipientId: number | null) => void;

  resetForm: <T extends Field>(fields: T[]) => T[];
};

export const useEditorFields = ({ envelope, handleFieldsUpdate }: EditorFieldsProps): UseEditorFieldsResponse => {
  const { t } = useLingui();
  const { toast } = useToast();

  const [selectedRecipientId, setSelectedRecipientId] = useState<number | null>(null);

  /**
   * How many times the field's meta has been rewritten to keep its group valid and in sync,
   * such as when it takes on the shared meta of a group it joins.
   */
  const [fieldMetaRewriteCounts, setFieldMetaRewriteCounts] = useState<Record<string, number>>({});

  const fieldsArray = useEditorFormArray<TLocalField, Field>({
    schema: ZLocalFieldSchema,
    sources: envelope.fields,
    mapSource: (field) => ({
      id: field.id,
      envelopeItemId: field.envelopeItemId,
      page: field.page,
      type: field.type,
      positionX: Number(field.positionX),
      positionY: Number(field.positionY),
      width: Number(field.width),
      height: Number(field.height),
      recipientId: field.recipientId,
      fieldMeta: field.fieldMeta ? ZFieldMetaSchema.parse(field.fieldMeta) : undefined,
      groupId: field.groupId,
      externalId: field.externalId,
    }),
    onChange: handleFieldsUpdate,
  });

  const setSelectedRecipient = useCallback(
    (recipientId: number | null) => {
      const foundRecipient = envelope.recipients.find((recipient) => recipient.id === recipientId);

      setSelectedRecipientId(foundRecipient?.id ?? null);
    },
    [envelope.recipients],
  );

  const setSelectedField = useCallback(
    (formId: string | null, bypassCheck = false) => {
      const foundField = formId ? fieldsArray.findItem(formId) : undefined;

      if (foundField) {
        setSelectedRecipient(foundField.recipientId);
      }

      fieldsArray.setSelected(formId, bypassCheck);
    },
    [fieldsArray.findItem, fieldsArray.setSelected, setSelectedRecipient],
  );

  // A group's validation rule is removed rather than blocking the change which made it
  // invalid, so the user is told why it disappeared.
  const notifyGroupValidationRemoved = useCallback(
    (groupIds: string[]) => {
      if (groupIds.length === 0) {
        return;
      }

      toast({
        title: t`Group validation removed`,
        description:
          groupIds.length === 1
            ? t`Group "${groupIds[0]}" no longer satisfies its validation rule, so the rule has been removed from its fields.`
            : t`${groupIds.length} groups no longer satisfy their validation rules, so the rules have been removed from their fields.`,
        duration: 7500,
      });
    },
    [t, toast],
  );

  /**
   * Applies a set of changes to the local fields while keeping every affected group
   * valid and in sync. Every field write goes through here except `setFieldId`, which
   * only records the IDs assigned by a save and must not trigger another one.
   *
   * Returns the fields as they are after the change.
   */
  const applyFieldChanges = useCallback(
    ({ fieldUpdates = [], newFields = [], removedFormIds = [] }: EditorFieldChanges): TLocalField[] => {
      const previousFields = fieldsArray.getItems();

      const previousFieldsByFormId = new Map(previousFields.map((field) => [field.formId, field]));

      const fieldUpdatesByFormId = new Map<string, EditorFieldUpdates>();

      for (const { formId, updates } of fieldUpdates) {
        if (previousFieldsByFormId.has(formId)) {
          fieldUpdatesByFormId.set(formId, { ...fieldUpdatesByFormId.get(formId), ...updates });
        }
      }

      const removedFormIdSet = new Set(removedFormIds.filter((formId) => previousFieldsByFormId.has(formId)));

      const hasChanges = fieldUpdatesByFormId.size > 0 || newFields.length > 0 || removedFormIdSet.size > 0;

      if (!hasChanges) {
        return previousFields;
      }

      const changedFormIds = new Set([...fieldUpdatesByFormId.keys(), ...newFields.map(({ formId }) => formId)]);

      const nextFields = previousFields
        .filter((field) => !removedFormIdSet.has(field.formId))
        .map((field) => {
          const updates = fieldUpdatesByFormId.get(field.formId);

          if (!updates) {
            return field;
          }

          const updatedField = {
            ...field,
            ...updates,
          };

          const hasTypeChanged = updates.type !== undefined && updates.type !== field.type;
          const hasRecipientChanged = updates.recipientId !== undefined && updates.recipientId !== field.recipientId;

          // Fields must be removed from groups if their type or recipient has changed.
          if (Boolean(updatedField.groupId) && (hasTypeChanged || hasRecipientChanged)) {
            updatedField.groupId = null;
          }

          return clampPercentageBox(updatedField);
        })
        .concat(newFields);

      const { reconciledFields, rewrittenFormIds, validationRemovedGroupIds, validationRemovedLeavingFields } =
        resolveEditorFieldGroupChanges({
          previousFields,
          nextFields,
          changedFormIds,
        });

      if (rewrittenFormIds.length > 0) {
        setFieldMetaRewriteCounts((counts) => ({
          ...counts,
          ...Object.fromEntries(rewrittenFormIds.map((formId) => [formId, (counts[formId] ?? 0) + 1])),
        }));
      }

      const appendedFields: TLocalField[] = [];
      const updatedFields: TLocalField[] = [];

      // Only touch the form entries which actually changed.
      for (const reconciledField of reconciledFields) {
        const previousField = previousFieldsByFormId.get(reconciledField.formId);

        if (!previousField) {
          appendedFields.push(reconciledField);
        } else if (!isDeepEqual(previousField, reconciledField)) {
          updatedFields.push(reconciledField);
        }
      }

      for (const updatedField of updatedFields) {
        fieldsArray.updateByFormId(updatedField.formId, () => updatedField, { shouldTriggerChange: false });
      }

      fieldsArray.removeByFormId([...removedFormIdSet], { shouldTriggerChange: false });
      fieldsArray.appendItems(appendedFields, { shouldTriggerChange: false });

      if (updatedFields.length > 0 || removedFormIdSet.size > 0 || appendedFields.length > 0) {
        fieldsArray.triggerChange();
      }

      notifyGroupValidationRemoved(validationRemovedGroupIds);

      // A field which leaves a group is validated on its own, so a rule it cannot meet alone
      // is removed from that field only. If the group lost its rule as well, the group's
      // message already covers it.
      const leavingFields = validationRemovedLeavingFields.filter(
        ({ groupId }) => !validationRemovedGroupIds.includes(groupId),
      );

      if (leavingFields.length > 0) {
        toast({
          title: t`Field validation removed`,
          description:
            leavingFields.length === 1
              ? t`The field left group "${leavingFields[0].groupId}" and cannot satisfy its validation rule on its own, so the rule has been removed from the field.`
              : t`${leavingFields.length} fields left their groups and cannot satisfy the validation rules on their own, so the rules have been removed from those fields.`,
          duration: 7500,
        });
      }

      return reconciledFields;
    },
    [
      fieldsArray.getItems,
      fieldsArray.updateByFormId,
      fieldsArray.removeByFormId,
      fieldsArray.appendItems,
      fieldsArray.triggerChange,
      notifyGroupValidationRemoved,
    ],
  );

  const resetForm = useCallback(
    <T extends Field>(remainingFields: T[]): T[] => {
      const previousFields = fieldsArray.getItems();

      const remainingFieldIds = new Set(remainingFields.map((field) => field.id));

      // A field which was never saved has no ID and is not counted. Dropping it cannot
      // make a saved group invalid, and counting it would report a rule as removed when
      // the reset only discarded an edit which failed to save.
      const removedGroupIds = new Set(
        previousFields.flatMap((field) => {
          const isRemoved = field.id !== undefined && !remainingFieldIds.has(field.id);

          return field.groupId && isRemoved ? [field.groupId] : [];
        }),
      );

      const fieldMetaByFieldId = reconcileFieldGroupsAfterRemoval({ remainingFields, groupIds: removedGroupIds });

      const reconciledFields = remainingFields.map((field) => {
        // Only fields of the affected groups can have changed, so nothing else is touched
        // even if it were to share an ID with one of them.
        if (!field.groupId || !removedGroupIds.has(field.groupId)) {
          return field;
        }

        const fieldMeta = fieldMetaByFieldId.get(field.id);

        return fieldMeta ? { ...field, fieldMeta } : field;
      });

      const hasGroupValidation = (
        fields: { groupId?: string | null; fieldMeta?: TFieldMetaSchema | null }[],
        groupId: string,
      ) => fields.some((field) => field.groupId === groupId && hasFieldGroupValidation(field.fieldMeta));

      // The server reconciles the same way when it is the one removing the fields, so they
      // can arrive here with the rule already gone. Comparing the rule before and after
      // covers that as well as a rule removed just now.
      const validationRemovedGroupIds = Array.from(removedGroupIds).filter(
        (groupId) => hasGroupValidation(previousFields, groupId) && !hasGroupValidation(reconciledFields, groupId),
      );

      fieldsArray.resetForm(reconciledFields);

      // A group which lost every field has nothing left to explain.
      notifyGroupValidationRemoved(
        validationRemovedGroupIds.filter((groupId) => reconciledFields.some((field) => field.groupId === groupId)),
      );

      return reconciledFields;
    },
    [fieldsArray.getItems, fieldsArray.resetForm, notifyGroupValidationRemoved],
  );

  const removeFieldsByFormId = useCallback(
    (formIds: string[]) => {
      applyFieldChanges({ removedFormIds: formIds });
    },
    [applyFieldChanges],
  );

  const addField = useCallback(
    (fieldData: Omit<TLocalField, 'formId'>): TLocalField => {
      const field: TLocalField = clampPercentageBox({
        ...fieldData,
        formId: createLocalFormId(),
      });

      const reconciledFields = applyFieldChanges({ newFields: [field] });

      setSelectedField(field.formId, true);

      return reconciledFields.find((reconciledField) => reconciledField.formId === field.formId) ?? field;
    },
    [applyFieldChanges, setSelectedField],
  );

  const setFieldId = (formId: string, id: number) => {
    fieldsArray.updateByFormId(formId, (field) => ({ ...field, id }), { shouldTriggerChange: false });
  };

  const updateFieldsByFormId = useCallback(
    (fieldUpdates: EditorFieldUpdate[]) => {
      applyFieldChanges({ fieldUpdates });
    },
    [applyFieldChanges],
  );

  const updateFieldByFormId = useCallback(
    (formId: string, updates: EditorFieldUpdates) => {
      updateFieldsByFormId([{ formId, updates }]);
    },
    [updateFieldsByFormId],
  );

  const duplicateField = useCallback(
    (field: TLocalField): TLocalField => {
      const newField: TLocalField = {
        ...structuredClone(field),
        id: undefined,
        formId: createLocalFormId(),
        positionX: field.positionX + EDITOR_DUPLICATE_ITEM_OFFSET,
        positionY: field.positionY + EDITOR_DUPLICATE_ITEM_OFFSET,
      };

      const reconciledFields = applyFieldChanges({ newFields: [newField] });

      return reconciledFields.find((reconciledField) => reconciledField.formId === newField.formId) ?? newField;
    },
    [applyFieldChanges],
  );

  const duplicateFieldToAllPages = useCallback(
    (field: TLocalField): TLocalField[] => {
      const newFields = getOtherPageNumbers(field.page).map(
        (page): TLocalField => ({
          ...structuredClone(field),
          id: undefined,
          formId: createLocalFormId(),
          page,
        }),
      );

      const newFormIds = new Set(newFields.map((newField) => newField.formId));

      const reconciledFields = applyFieldChanges({ newFields });

      return reconciledFields.filter((reconciledField) => newFormIds.has(reconciledField.formId));
    },
    [applyFieldChanges],
  );

  const getFieldMetaRewriteCount = useCallback(
    (formId: string) => fieldMetaRewriteCounts[formId] ?? 0,
    [fieldMetaRewriteCounts],
  );

  const selectedRecipient = useMemo(() => {
    return envelope.recipients.find((recipient) => recipient.id === selectedRecipientId) || null;
  }, [selectedRecipientId, envelope.recipients]);

  return {
    // Core state
    localFields: fieldsArray.items,

    // Field operations
    addField,
    setFieldId,
    removeFieldsByFormId,
    updateFieldByFormId,
    updateFieldsByFormId,
    duplicateField,
    duplicateFieldToAllPages,

    // Field utilities
    getFieldByFormId: fieldsArray.findItem,
    getFieldMetaRewriteCount,

    // Selected field
    selectedField: fieldsArray.selectedItem,
    setSelectedField,

    // Selected recipient
    selectedRecipient,
    setSelectedRecipient,

    resetForm,
  };
};
