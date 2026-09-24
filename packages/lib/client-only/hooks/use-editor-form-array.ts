import { getPdfPagesCount } from '@documenso/lib/constants/pdf-viewer';
import { nanoid } from '@documenso/lib/universal/id';
import { zodResolver } from '@hookform/resolvers/zod';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { type Resolver, useFieldArray, useForm } from 'react-hook-form';
import { z } from 'zod';

import { useLatestRef } from './use-latest-ref';

/**
 * The length of the client side IDs given to items created in the editor.
 */
const LOCAL_FORM_ID_LENGTH = 12;

type EditorItem = {
  /**
   * The local client side ID of the item, stable for its editor lifetime.
   */
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

  /**
   * The persisted items the local list starts from and is reset to.
   */
  sources: TSource[];

  /**
   * Map a persisted item to its local shape. The form ID is assigned by the
   * hook.
   */
  mapSource: (source: TSource) => Omit<TItem, 'formId'>;

  /**
   * Called after any change which needs saving. Receives a getter so the
   * values are read when the save is sent, not when it was queued, which
   * matters when a save in flight corrects the local items (e.g. assigns
   * server IDs).
   */
  onChange: (getItems: () => TItem[]) => unknown;
};

/**
 * The local, autosaved list backing an editor surface (fields, contents).
 *
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

  // The callers pass these as inline functions, so they are read through refs
  // to keep every operation below referentially stable. Long lived callbacks
  // (e.g. Konva handlers) capture those operations and must not go stale.
  const mapSourceRef = useLatestRef(mapSource);
  const onChangeRef = useLatestRef(onChange);

  const toDefaultValues = useCallback(
    (items: TSource[]): EditorFormArrayValues => ({
      items: items.map((source) => ({ ...mapSourceRef.current(source), formId: createLocalFormId() })),
    }),
    [],
  );

  // Only read on mount, so compute it once rather than on every render.
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

  // `useFieldArray` merges its own key into each item, which the callers do
  // not want to see.
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const items = fields as unknown as TItem[];

  /**
   * The live items. This is the form's own array, so callers must treat the
   * items as read only and replace rather than mutate them.
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

  /**
   * Select an item by form ID. Unless bypassed, an ID which is not in the
   * list clears the selection.
   */
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

      // A single append so the list updates once however many items there are.
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

  /**
   * Replace an item with the result of `updater`. Returning the same item
   * (by reference) leaves the list untouched and does not trigger a save.
   */
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

  // Drop the selection once its item leaves the list.
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

/**
 * A fresh local ID for an item created in the editor.
 */
export const createLocalFormId = () => nanoid(LOCAL_FORM_ID_LENGTH);

/**
 * Every page of the current document except the given one, for duplicating
 * an item across pages.
 */
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
