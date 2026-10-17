import { getPdfPagesCount } from '@documenso/lib/constants/pdf-viewer';
import type { TEditorEnvelope } from '@documenso/lib/types/envelope-editor';
import { ZFieldMetaSchema } from '@documenso/lib/types/field-meta';
import { nanoid } from '@documenso/lib/universal/id';
import { zodResolver } from '@hookform/resolvers/zod';
import type { Field } from '@prisma/client';
import { FieldType } from '@prisma/client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { isDeepEqual } from 'remeda';
import { z } from 'zod';

import {
  applyEditorFieldUpdate,
  type EditorFieldChanges,
  type EditorFieldUpdate,
  resolveEditorFieldGroupChanges,
  restrictFieldPosValues,
} from '../editor-field-group-changes';

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

const ZEditorFieldsFormSchema = z.object({
  fields: z.array(ZLocalFieldSchema),
});

export type TEditorFieldsFormSchema = z.infer<typeof ZEditorFieldsFormSchema>;

type EditorFieldsProps = {
  envelope: TEditorEnvelope;
  handleFieldsUpdate: (fields: TLocalField[]) => unknown;
  /**
   * Called when a change caused the validation rule of a group to be removed, because
   * the group would otherwise have become invalid.
   */
  onFieldGroupValidationRemoved?: (groupIds: string[]) => void;
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
  updateFieldsByFormId: (fieldUpdates: EditorFieldUpdate[]) => void;
  duplicateField: (field: TLocalField, recipientId?: number) => TLocalField;
  duplicateFieldToAllPages: (field: TLocalField, recipientId?: number) => TLocalField[];

  // Field utilities
  getFieldByFormId: (formId: string) => TLocalField | undefined;
  getFieldsByRecipient: (recipientId: number) => TLocalField[];

  // Selected recipient
  selectedRecipient: TEditorEnvelope['recipients'][number] | null;
  setSelectedRecipient: (recipientId: number | null) => void;

  resetForm: (fields?: Field[]) => void;
};

export const useEditorFields = ({
  envelope,
  handleFieldsUpdate,
  onFieldGroupValidationRemoved,
}: EditorFieldsProps): UseEditorFieldsResponse => {
  const [selectedFieldFormId, setSelectedFieldFormId] = useState<string | null>(null);
  const [selectedRecipientId, setSelectedRecipientId] = useState<number | null>(null);

  const generateDefaultValues = (fields?: Field[]) => {
    const formFields = (fields || envelope.fields).map(
      (field): TLocalField => ({
        id: field.id,
        formId: nanoid(),
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
    );

    return {
      fields: formFields,
    };
  };

  const form = useForm<TEditorFieldsFormSchema>({
    defaultValues: generateDefaultValues(),
    resolver: zodResolver(ZEditorFieldsFormSchema),
  });

  const {
    append,
    remove,
    update,
    fields: localFields,
  } = useFieldArray({
    control: form.control,
    name: 'fields',
    keyName: 'react-hook-form-id',
  });

  const triggerFieldsUpdate = () => {
    void handleFieldsUpdate(form.getValues().fields);
  };

  const setSelectedField = (formId: string | null, bypassCheck = false) => {
    if (!formId) {
      setSelectedFieldFormId(null);
      return;
    }

    const foundField = localFields.find((field) => field.formId === formId);
    const recipient = envelope.recipients.find((recipient) => recipient.id === foundField?.recipientId);

    if (recipient) {
      setSelectedRecipient(recipient.id);
    }

    if (bypassCheck) {
      setSelectedFieldFormId(formId);
      return;
    }

    setSelectedFieldFormId(foundField?.formId ?? null);
  };

  const addField = useCallback(
    (fieldData: Omit<TLocalField, 'formId'>): TLocalField => {
      const field: TLocalField = {
        ...fieldData,
        formId: nanoid(12),
        ...restrictFieldPosValues(fieldData),
      };

      append(field);
      triggerFieldsUpdate();
      setSelectedField(field.formId, true);
      return field;
    },
    [append, triggerFieldsUpdate, setSelectedField],
  );

  /**
   * Applies a set of changes to the local fields while keeping every affected group
   * valid and in sync. This is the single entry point for all field writes.
   *
   * Returns the fields as they are after the change.
   */
  const applyFieldChanges = useCallback(
    ({ fieldUpdates = [], newFields = [], removedFormIds = [] }: EditorFieldChanges): TLocalField[] => {
      const previousFields = form.getValues().fields;

      const previousFormIds = new Set(previousFields.map((field) => field.formId));

      const fieldUpdatesByFormId = new Map(
        fieldUpdates.filter(({ formId }) => previousFormIds.has(formId)).map((update) => [update.formId, update]),
      );

      const removedFormIdSet = new Set(removedFormIds.filter((formId) => previousFormIds.has(formId)));

      const hasChanges = fieldUpdatesByFormId.size > 0 || newFields.length > 0 || removedFormIdSet.size > 0;

      if (!hasChanges) {
        return previousFields;
      }

      const changedFormIds = new Set([...fieldUpdatesByFormId.keys(), ...newFields.map(({ formId }) => formId)]);

      const nextFields = previousFields
        .filter((field) => !removedFormIdSet.has(field.formId))
        .map((field) => {
          const fieldUpdate = fieldUpdatesByFormId.get(field.formId);

          return fieldUpdate ? applyEditorFieldUpdate(field, fieldUpdate.updates) : field;
        })
        .concat(newFields);

      const { reconciledFields, validationRemovedGroupIds } = resolveEditorFieldGroupChanges({
        previousFields,
        nextFields,
        changedFormIds,
      });

      // Only touch the form entries which actually changed.
      reconciledFields.forEach((reconciledField) => {
        const index = previousFields.findIndex((field) => field.formId === reconciledField.formId);

        if (index === -1) {
          append(reconciledField);
          return;
        }

        if (!isDeepEqual(previousFields[index], reconciledField)) {
          update(index, reconciledField);
        }
      });

      const removedIndexes = previousFields
        .map((field, index) => (removedFormIdSet.has(field.formId) ? index : -1))
        .filter((index) => index !== -1);

      if (removedIndexes.length > 0) {
        remove(removedIndexes);
      }

      triggerFieldsUpdate();

      if (validationRemovedGroupIds.length > 0) {
        onFieldGroupValidationRemoved?.(validationRemovedGroupIds);
      }

      return reconciledFields;
    },
    [form, append, update, remove, triggerFieldsUpdate, onFieldGroupValidationRemoved],
  );

  const removeFieldsByFormId = useCallback(
    (formIds: string[]) => {
      applyFieldChanges({ removedFormIds: formIds });
    },
    [applyFieldChanges],
  );

  const setFieldId = (formId: string, id: number) => {
    const { fields } = form.getValues();

    const index = fields.findIndex((field) => field.formId === formId);

    if (index !== -1) {
      update(index, {
        ...fields[index],
        id,
      });
    }
  };

  const updateFieldsByFormId = useCallback(
    (fieldUpdates: EditorFieldUpdate[]) => {
      applyFieldChanges({ fieldUpdates });
    },
    [applyFieldChanges],
  );

  const updateFieldByFormId = useCallback(
    (formId: string, updates: Partial<TLocalField>) => {
      updateFieldsByFormId([{ formId, updates }]);
    },
    [updateFieldsByFormId],
  );

  const duplicateField = useCallback(
    (field: TLocalField): TLocalField => {
      const newField: TLocalField = {
        ...structuredClone(field),
        id: undefined,
        formId: nanoid(12),
        recipientId: field.recipientId,
        positionX: field.positionX + 3,
        positionY: field.positionY + 3,
      };

      const reconciledFields = applyFieldChanges({ newFields: [newField] });

      return reconciledFields.find((reconciledField) => reconciledField.formId === newField.formId) ?? newField;
    },
    [applyFieldChanges],
  );

  const duplicateFieldToAllPages = useCallback(
    (field: TLocalField): TLocalField[] => {
      const totalPages = getPdfPagesCount();
      const newFields: TLocalField[] = [];

      if (totalPages < 1) {
        return newFields;
      }

      for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
        if (pageNumber === field.page) {
          continue;
        }

        newFields.push({
          ...structuredClone(field),
          id: undefined,
          formId: nanoid(12),
          page: pageNumber,
        });
      }

      const newFormIds = new Set(newFields.map((newField) => newField.formId));

      const reconciledFields = applyFieldChanges({ newFields });

      return reconciledFields.filter((reconciledField) => newFormIds.has(reconciledField.formId));
    },
    [applyFieldChanges],
  );

  const getFieldByFormId = useCallback(
    (formId: string): TLocalField | undefined => {
      return localFields.find((field) => field.formId === formId) as TLocalField | undefined;
    },
    [localFields],
  );

  const getFieldsByRecipient = useCallback(
    (recipientId: number): TLocalField[] => {
      return localFields.filter((field) => field.recipientId === recipientId);
    },
    [localFields],
  );

  const selectedRecipient = useMemo(() => {
    return envelope.recipients.find((recipient) => recipient.id === selectedRecipientId) || null;
  }, [selectedRecipientId, envelope.recipients]);

  const selectedField = useMemo(() => {
    return localFields.find((field) => field.formId === selectedFieldFormId);
  }, [selectedFieldFormId, localFields]);

  /**
   * Keep the selected field form ID in sync with the local fields.
   */
  useEffect(() => {
    const foundField = localFields.find((field) => field.formId === selectedFieldFormId);
    setSelectedFieldFormId(foundField?.formId ?? null);
  }, [selectedFieldFormId, localFields]);

  const setSelectedRecipient = (recipientId: number | null) => {
    const foundRecipient = envelope.recipients.find((recipient) => recipient.id === recipientId);

    setSelectedRecipientId(foundRecipient?.id ?? null);
  };

  const resetForm = (fields?: Field[]) => {
    form.reset(generateDefaultValues(fields));
  };

  return {
    // Core state
    localFields,

    // Field operations
    addField,
    setFieldId,
    removeFieldsByFormId,
    updateFieldByFormId,
    updateFieldsByFormId,
    duplicateField,
    duplicateFieldToAllPages,

    // Field utilities
    getFieldByFormId,
    getFieldsByRecipient,

    // Selected field
    selectedField,
    setSelectedField,

    // Selected recipient
    selectedRecipient,
    setSelectedRecipient,

    resetForm,
  };
};
