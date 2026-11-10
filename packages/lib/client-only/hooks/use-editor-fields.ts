import type { TEditorEnvelope } from '@documenso/lib/types/envelope-editor';
import { ZFieldMetaSchema } from '@documenso/lib/types/field-meta';
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
  applyEditorFieldUpdate,
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

  // Selected recipient
  selectedRecipient: TEditorEnvelope['recipients'][number] | null;
  setSelectedRecipient: (recipientId: number | null) => void;

  resetForm: (fields?: Field[]) => void;
};

export const useEditorFields = ({ envelope, handleFieldsUpdate }: EditorFieldsProps): UseEditorFieldsResponse => {
  const { t } = useLingui();
  const { toast } = useToast();

  const [selectedRecipientId, setSelectedRecipientId] = useState<number | null>(null);

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

          return updates ? applyEditorFieldUpdate(field, updates) : field;
        })
        .concat(newFields);

      const { reconciledFields, validationRemovedGroupIds } = resolveEditorFieldGroupChanges({
        previousFields,
        nextFields,
        changedFormIds,
      });

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

      // Changes are never blocked by a group becoming invalid. Its validation rule is
      // removed instead, so the user is told why it disappeared.
      if (validationRemovedGroupIds.length > 0) {
        toast({
          title: t`Group validation removed`,
          description:
            validationRemovedGroupIds.length === 1
              ? t`Group "${validationRemovedGroupIds[0]}" no longer satisfies its validation rule, so the rule has been removed from its fields.`
              : t`${validationRemovedGroupIds.length} groups no longer satisfy their validation rules, so the rules have been removed from their fields.`,
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
      t,
      toast,
    ],
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

    // Selected field
    selectedField: fieldsArray.selectedItem,
    setSelectedField,

    // Selected recipient
    selectedRecipient,
    setSelectedRecipient,

    resetForm: fieldsArray.resetForm,
  };
};
