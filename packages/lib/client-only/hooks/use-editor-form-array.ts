import { getPdfPagesCount } from '@documenso/lib/constants/pdf-viewer';
import { nanoid } from '@documenso/lib/universal/id';
import { zodResolver } from '@hookform/resolvers/zod';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { type Resolver, useFieldArray, useForm } from 'react-hook-form';
import { z } from 'zod';

import { useLatestRef } from './use-latest-ref';

const LOCAL_FORM_ID_LENGTH = 12;

type EditorItem = {
  formId: string;
};

/**
 * The form is typed against the base item internally, since react-hook-form
 * cannot resolve field paths against an open generic. Values are cast back to
 * the caller's item type at the boundary.
 */
type EditorFormArrayValues = {
  items: EditorItem[];
};

type UseEditorFormArrayOptions<TItem extends EditorItem, TSource> = {
  schema: z.ZodType<TItem, z.ZodTypeDef, unknown>;

  sources: TSource[];

  mapSource: (source: TSource) => Omit<TItem, 'formId'>;

  /**
   * Receives a getter so the values are read when the save is sent, not when
   * it was queued, which matters when a save in flight corrects the local
   * items (e.g. assigns server IDs).
   */
  onChange: (getItems: () => TItem[]) => unknown;
};

/**
 * All lookups and writes go through the live form values rather than the
 * render captured list. Callers can be arbitrarily far behind the list, e.g.
 * a Konva handler bound at render time or an upload finishing after its item
 * was deleted, and an index resolved from a stale list would hit whichever
 * item has since moved into that slot.
 */
export const useEditorFormArray = <TItem extends EditorItem, TSource>({
  schema,
  sources,
  mapSource,
  onChange,
}: UseEditorFormArrayOptions<TItem, TSource>) => {
  const [selectedFormId, setSelectedFormId] = useState<string | null>(null);

  // Keeps every operation below referentially stable for the long lived Konva
  // handlers which capture them.
  const mapSourceRef = useLatestRef(mapSource);
  const onChangeRef = useLatestRef(onChange);

  const toDefaultValues = useCallback(
    (items: TSource[]): EditorFormArrayValues => ({
      items: items.map((source) => ({ ...mapSourceRef.current(source), formId: createLocalFormId() })),
    }),
    [],
  );

  const [initialValues] = useState(() => toDefaultValues(sources));

  const form = useForm<EditorFormArrayValues>({
    defaultValues: initialValues,
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    resolver: zodResolver(z.object({ items: z.array(schema) })) as Resolver<EditorFormArrayValues>,
  });

  const { append, remove, update, fields } = useFieldArray({
    control: form.control,
    name: 'items',
    keyName: 'react-hook-form-id',
  });

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const items = fields as unknown as TItem[];

  /**
   * This is the form's own array, so callers must treat the items as read
   * only and replace rather than mutate them.
   */
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const getItems = useCallback(() => form.getValues().items as TItem[], [form]);

  const findIndex = useCallback((formId: string) => getItems().findIndex((item) => item.formId === formId), [getItems]);

  const findItem = useCallback(
    (formId: string): TItem | undefined => getItems().find((item) => item.formId === formId),
    [getItems],
  );

  const triggerChange = useCallback(() => {
    void onChangeRef.current(getItems);
  }, [getItems]);

  const setSelected = useCallback(
    (formId: string | null, bypassCheck = false) => {
      if (!formId || bypassCheck) {
        setSelectedFormId(formId);
        return;
      }

      setSelectedFormId(findItem(formId)?.formId ?? null);
    },
    [findItem],
  );

  const appendItems = useCallback(
    (newItems: TItem[]) => {
      if (newItems.length === 0) {
        return;
      }

      append(newItems);
      triggerChange();
    },
    [append, triggerChange],
  );

  const removeByFormId = useCallback(
    (formIds: string[]) => {
      const indexes = formIds.map((formId) => findIndex(formId)).filter((index) => index !== -1);

      if (indexes.length === 0) {
        return;
      }

      remove(indexes);
      triggerChange();
    },
    [findIndex, remove, triggerChange],
  );

  const updateByFormId = useCallback(
    (formId: string, updater: (current: TItem) => TItem, { shouldTriggerChange = true } = {}) => {
      const index = findIndex(formId);

      if (index === -1) {
        return;
      }

      const current = getItems()[index];
      const next = updater(current);

      if (next === current) {
        return;
      }

      update(index, next);

      if (shouldTriggerChange) {
        triggerChange();
      }
    },
    [findIndex, getItems, update, triggerChange],
  );

  const selectedItem = useMemo(() => items.find((item) => item.formId === selectedFormId), [items, selectedFormId]);

  useEffect(() => {
    if (selectedFormId && !items.some((item) => item.formId === selectedFormId)) {
      setSelectedFormId(null);
    }
  }, [items, selectedFormId]);

  const sourcesRef = useLatestRef(sources);

  const resetForm = useCallback(
    (nextSources?: TSource[]) => {
      form.reset(toDefaultValues(nextSources ?? sourcesRef.current));
    },
    [form, toDefaultValues],
  );

  return {
    items,
    getItems,
    findItem,
    appendItems,
    removeByFormId,
    updateByFormId,
    selectedItem,
    setSelected,
    resetForm,
  };
};

export const createLocalFormId = () => nanoid(LOCAL_FORM_ID_LENGTH);

export const getOtherPageNumbers = (currentPage: number) => {
  const totalPages = getPdfPagesCount();

  const pages: number[] = [];

  for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
    if (pageNumber !== currentPage) {
      pages.push(pageNumber);
    }
  }

  return pages;
};
