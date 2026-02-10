import { useCallback, useEffect, useMemo, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import type { Field, Recipient } from '@prisma/client';
import { FieldType } from '@prisma/client';
import { useFieldArray, useForm } from 'react-hook-form';
import { z } from 'zod';

import { ZFieldMetaSchema } from '@documenso/lib/types/field-meta';
import { nanoid } from '@documenso/lib/universal/id';

import type { TEnvelope } from '../../types/envelope';

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

const ZEditorFieldsFormSchema = z.object({
  fields: z.array(ZLocalFieldSchema),
});

export type TEditorFieldsFormSchema = z.infer<typeof ZEditorFieldsFormSchema>;

type EditorFieldsProps = {
  envelope: TEnvelope;
  handleFieldsUpdate: (fields: TLocalField[]) => unknown;
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
  duplicateField: (field: TLocalField, recipientId?: number) => TLocalField;
  duplicateFieldToAllPages: (field: TLocalField, recipientId?: number) => TLocalField[];

  // Field utilities
  getFieldByFormId: (formId: string) => TLocalField | undefined;
  getFieldsByRecipient: (recipientId: number) => TLocalField[];

  // Selected recipient
  selectedRecipient: Recipient | null;
  setSelectedRecipient: (recipientId: number | null) => void;

  resetForm: (fields?: Field[]) => void;
};

export const useEditorFields = ({
  envelope,
  handleFieldsUpdate,
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
    const recipient = envelope.recipients.find(
      (recipient) => recipient.id === foundField?.recipientId,
    );

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

  const removeFieldsByFormId = useCallback(
    (formIds: string[]) => {
      const indexes = formIds
        .map((formId) => localFields.findIndex((field) => field.formId === formId))
        .filter((index) => index !== -1);

      if (indexes.length > 0) {
        remove(indexes);
        triggerFieldsUpdate();
      }
    },
    [localFields, remove, triggerFieldsUpdate],
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

  const updateFieldByFormId = useCallback(
    (formId: string, updates: Partial<TLocalField>) => {
      const index = localFields.findIndex((field) => field.formId === formId);

      if (index !== -1) {
        const updatedField = {
          ...localFields[index],
          ...updates,
        };

        update(index, {
          ...updatedField,
          ...restrictFieldPosValues(updatedField),
        });
        triggerFieldsUpdate();
      }
    },
    [localFields, update, triggerFieldsUpdate],
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

      append(newField);
      triggerFieldsUpdate();
      return newField;
    },
    [append, triggerFieldsUpdate],
  );

  const duplicateFieldToAllPages = useCallback(
    (field: TLocalField): TLocalField[] => {
      const pages = Array.from(document.querySelectorAll('[data-page-number]'));
      const newFields: TLocalField[] = [];

      pages.forEach((_, index) => {
        const pageNumber = index + 1;

        if (pageNumber === field.page) {
          return;
        }

        const newField: TLocalField = {
          ...structuredClone(field),
          id: undefined,
          formId: nanoid(12),
          page: pageNumber,
        };

        append(newField);
        newFields.push(newField);
      });

      triggerFieldsUpdate();
      return newFields;
    },
    [append, triggerFieldsUpdate],
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

const restrictFieldPosValues = (
  field: Pick<TLocalField, 'positionX' | 'positionY' | 'width' | 'height'>,
) => {
  return {
    positionX: Math.max(0, Math.min(100, field.positionX)),
    positionY: Math.max(0, Math.min(100, field.positionY)),
    width: Math.max(0, Math.min(100, field.width)),
    height: Math.max(0, Math.min(100, field.height)),
  };
};
