import type { TEditorEnvelope } from '@documenso/lib/types/envelope-editor';
import { ZFieldMetaSchema } from '@documenso/lib/types/field-meta';
import { clampPercentageBox } from '@documenso/lib/utils/geometry';
import type { Field } from '@prisma/client';
import { FieldType } from '@prisma/client';
import { useCallback, useMemo, useState } from 'react';
import { z } from 'zod';
import { EDITOR_DUPLICATE_ITEM_OFFSET } from '../../constants/envelope-editor';
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
});

export type TLocalField = z.infer<typeof ZLocalFieldSchema>;

type EditorFieldsProps = {
  envelope: TEditorEnvelope;

  /**
   * Receives a getter rather than the fields so the values are read when the
   * save is sent, not when it was queued.
   */
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
  updateFieldByFormId: (formId: string, updates: Partial<TLocalField>) => void;
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

  /**
   * Selecting a field also selects its recipient.
   */
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

  const addField = useCallback(
    (fieldData: Omit<TLocalField, 'formId'>): TLocalField => {
      const field: TLocalField = clampPercentageBox({
        ...fieldData,
        formId: createLocalFormId(),
      });

      fieldsArray.appendItems([field]);
      setSelectedField(field.formId, true);

      return field;
    },
    [fieldsArray.appendItems, setSelectedField],
  );

  /**
   * Adopt the ID assigned by the server after a save, without triggering
   * another save.
   */
  const setFieldId = (formId: string, id: number) => {
    fieldsArray.updateByFormId(formId, (field) => ({ ...field, id }), { shouldTriggerChange: false });
  };

  const updateFieldByFormId = useCallback(
    (formId: string, updates: Partial<TLocalField>) => {
      fieldsArray.updateByFormId(formId, (field) => clampPercentageBox({ ...field, ...updates }));
    },
    [fieldsArray.updateByFormId],
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

      fieldsArray.appendItems([newField]);

      return newField;
    },
    [fieldsArray.appendItems],
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

      if (newFields.length > 0) {
        fieldsArray.appendItems(newFields);
      }

      return newFields;
    },
    [fieldsArray.appendItems],
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
    removeFieldsByFormId: fieldsArray.removeByFormId,
    updateFieldByFormId,
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
