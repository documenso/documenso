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

  /**
   * Attaches a server-generated id to the local row for `formId` WITHOUT
   * firing `handleRedactionsUpdate`. This is the path the provider uses after
   * a successful create so the id arrives in local state without re-entering
   * the sync handler (which would try to re-diff mid-flight and can race
   * against pending state commits).
   */
  setRedactionIdByFormId: (formId: string, id: number) => void;

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
      // Read the base record from the live form state, not from the
      // closed-over `localRedactions` array. Two updates fired before React
      // commits the re-render between them (e.g. resize immediately followed
      // by a drag) would otherwise see a stale base and silently revert the
      // first update's fields.
      const currentRedactions = form.getValues().redactions;
      const index = currentRedactions.findIndex((redaction) => redaction.formId === formId);

      if (index !== -1) {
        const updatedRedaction = {
          ...currentRedactions[index],
          ...updates,
        };

        update(index, updatedRedaction);
        triggerRedactionsUpdate();
      }
    },
    [form, update, triggerRedactionsUpdate],
  );

  const setRedactionIdByFormId = useCallback(
    (formId: string, id: number) => {
      const index = localRedactions.findIndex((redaction) => redaction.formId === formId);

      if (index === -1) {
        return;
      }

      // `setValue` on a specific path does NOT trigger the field-array's
      // change signal the way `update` does. This is deliberate: attaching a
      // server id is bookkeeping, not a user edit, and should not re-enter
      // `handleRedactionsUpdate`.
      form.setValue(`redactions.${index}.id`, id, {
        shouldDirty: false,
        shouldTouch: false,
        shouldValidate: false,
      });
    },
    [localRedactions, form],
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
      setRedactionIdByFormId,
      resetForm,
    }),
    [
      localRedactions,
      addRedaction,
      removeRedactionsByFormId,
      updateRedactionByFormId,
      setRedactionIdByFormId,
      resetForm,
    ],
  );
};
