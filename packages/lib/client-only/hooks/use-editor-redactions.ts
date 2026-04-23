import { useCallback, useMemo } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useFieldArray, useForm } from 'react-hook-form';
import { z } from 'zod';

import type { TEnvelopeRedaction } from '@documenso/lib/types/envelope-editor';
import { nanoid } from '@documenso/lib/universal/id';

export const ZLocalRedactionSchema = z.object({
  // This is the actual ID of the redaction if created.
  id: z.number().optional(),
  // This is the local client side ID of the redaction.
  formId: z.string().min(1),
  // This is the ID of the envelope item to put the redaction on.
  envelopeItemId: z.string(),
  page: z.number().min(1),
  positionX: z.number().min(0),
  positionY: z.number().min(0),
  width: z.number().min(0),
  height: z.number().min(0),
});

export type TLocalRedaction = z.infer<typeof ZLocalRedactionSchema>;

const ZEditorRedactionsFormSchema = z.object({
  redactions: z.array(ZLocalRedactionSchema),
});

export type TEditorRedactionsFormSchema = z.infer<typeof ZEditorRedactionsFormSchema>;

type EditorRedactionsProps = {
  initialRedactions: TEnvelopeRedaction[];
  handleRedactionsUpdate: (redactions: TLocalRedaction[]) => unknown;
};

type UseEditorRedactionsResponse = {
  localRedactions: TLocalRedaction[];

  // Redaction operations
  addRedaction: (redaction: Omit<TLocalRedaction, 'formId'>) => TLocalRedaction;
  removeRedactionsByFormId: (formIds: string[]) => void;
  updateRedactionByFormId: (formId: string, updates: Partial<TLocalRedaction>) => void;

  resetForm: (redactions?: TEnvelopeRedaction[]) => void;
};

export const useEditorRedactions = ({
  initialRedactions,
  handleRedactionsUpdate,
}: EditorRedactionsProps): UseEditorRedactionsResponse => {
  const generateDefaultValues = (redactions?: TEnvelopeRedaction[]) => {
    const formRedactions = (redactions || initialRedactions).map(
      (redaction): TLocalRedaction => ({
        id: redaction.id,
        formId: nanoid(12),
        envelopeItemId: redaction.envelopeItemId,
        page: redaction.page,
        positionX: Number(redaction.positionX),
        positionY: Number(redaction.positionY),
        width: Number(redaction.width),
        height: Number(redaction.height),
      }),
    );

    return {
      redactions: formRedactions,
    };
  };

  const form = useForm<TEditorRedactionsFormSchema>({
    defaultValues: generateDefaultValues(),
    resolver: zodResolver(ZEditorRedactionsFormSchema),
  });

  const {
    append,
    remove,
    update,
    fields: localRedactions,
  } = useFieldArray({
    control: form.control,
    name: 'redactions',
    keyName: 'react-hook-form-id',
  });

  const triggerRedactionsUpdate = () => {
    void handleRedactionsUpdate(form.getValues().redactions);
  };

  const addRedaction = useCallback(
    (redactionData: Omit<TLocalRedaction, 'formId'>): TLocalRedaction => {
      const redaction: TLocalRedaction = {
        ...redactionData,
        formId: nanoid(12),
      };

      append(redaction);
      triggerRedactionsUpdate();
      return redaction;
    },
    [append, triggerRedactionsUpdate],
  );

  const removeRedactionsByFormId = useCallback(
    (formIds: string[]) => {
      const indexes = formIds
        .map((formId) => localRedactions.findIndex((redaction) => redaction.formId === formId))
        .filter((index) => index !== -1);

      if (indexes.length > 0) {
        remove(indexes);
        triggerRedactionsUpdate();
      }
    },
    [localRedactions, remove, triggerRedactionsUpdate],
  );

  const updateRedactionByFormId = useCallback(
    (formId: string, updates: Partial<TLocalRedaction>) => {
      const index = localRedactions.findIndex((redaction) => redaction.formId === formId);

      if (index !== -1) {
        const updatedRedaction = {
          ...localRedactions[index],
          ...updates,
        };

        update(index, updatedRedaction);
        triggerRedactionsUpdate();
      }
    },
    [localRedactions, update, triggerRedactionsUpdate],
  );

  const resetForm = (redactions?: TEnvelopeRedaction[]) => {
    form.reset(generateDefaultValues(redactions));
  };

  return useMemo(
    () => ({
      localRedactions,
      addRedaction,
      removeRedactionsByFormId,
      updateRedactionByFormId,
      resetForm,
    }),
    [localRedactions, addRedaction, removeRedactionsByFormId, updateRedactionByFormId, resetForm],
  );
};
