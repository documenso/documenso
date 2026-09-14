import { getPdfPagesCount } from '@documenso/lib/constants/pdf-viewer';
import type { TEnvelopeContentMetaOutput } from '@documenso/lib/types/envelope-content-meta';
import { EnvelopeContentType, ZEnvelopeContentMetaSchema } from '@documenso/lib/types/envelope-content-meta';
import type { TEditorEnvelope } from '@documenso/lib/types/envelope-editor';
import { nanoid } from '@documenso/lib/universal/id';
import { getLocalContentOrderId, getNextContentZIndex, isContentOnTop } from '@documenso/lib/utils/envelope-content';
import { zodResolver } from '@hookform/resolvers/zod';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { match } from 'ts-pattern';
import { z } from 'zod';

/**
 * The local editor representation of an envelope content.
 *
 * Note: Unlike fields, geometry (page, position and size) is stored within the
 * content metadata since it differs per content type, e.g. lines use start/end
 * coordinates instead of a position and size.
 */
export const ZLocalContentSchema = z.object({
  // This is the actual ID of the envelope content if created.
  id: z.string().optional(),
  // This is the local client side ID of the content.
  formId: z.string().min(1),
  // This is the ID of the envelope item to put the content on.
  envelopeItemId: z.string(),
  contentMeta: ZEnvelopeContentMetaSchema,
  // This is the ID of the uploaded data content (e.g. an image) attached to
  // the content, if any.
  dataContentId: z.string().nullish(),
  // The stacking order among the contents of the page, higher on top.
  zIndex: z.number().int(),
});

export type TLocalContent = z.infer<typeof ZLocalContentSchema>;

const ZEditorContentsFormSchema = z.object({
  contents: z.array(ZLocalContentSchema),
});

export type TEditorContentsFormSchema = z.infer<typeof ZEditorContentsFormSchema>;

type EditorContentsProps = {
  envelope: TEditorEnvelope;
  /**
   * Receives a getter rather than the contents so the values are read when
   * the save is sent, not when it was queued.
   */
  handleContentsUpdate: (getContents: () => TLocalContent[]) => unknown;
};

type UseEditorContentsResponse = {
  localContents: TLocalContent[];

  // Selected content
  selectedContent: TLocalContent | undefined;
  setSelectedContent: (formId: string | null) => void;

  // Content operations
  addContent: (content: Omit<TLocalContent, 'formId' | 'zIndex'>) => TLocalContent;
  setContentPersistedIds: (
    formId: string,
    persisted: { id: string; dataContentId: string | null },
    sentDataContentId: string | null,
  ) => void;
  removeContentsByFormId: (formIds: string[]) => void;
  updateContentByFormId: (formId: string, updates: Partial<TLocalContent>) => void;
  duplicateContent: (content: TLocalContent) => TLocalContent;
  duplicateContentToAllPages: (content: TLocalContent) => TLocalContent[];

  // Content utilities
  getContentByFormId: (formId: string) => TLocalContent | undefined;

  /**
   * Place the content above every other content on its page, unless it is
   * already on top.
   */
  bringContentToFront: (formId: string) => void;

  resetForm: (contents?: TEditorEnvelope['contents']) => void;
};

export const useEditorContents = ({
  envelope,
  handleContentsUpdate,
}: EditorContentsProps): UseEditorContentsResponse => {
  const [selectedContentFormId, setSelectedContentFormId] = useState<string | null>(null);

  const generateDefaultValues = (contents?: TEditorEnvelope['contents']) => {
    const formContents = (contents || envelope.contents).map(
      (content): TLocalContent => ({
        id: content.id,
        formId: nanoid(),
        envelopeItemId: content.envelopeItemId,
        contentMeta: content.metadata,
        dataContentId: content.dataContentId,
        zIndex: content.zIndex,
      }),
    );

    return {
      contents: formContents,
    };
  };

  const form = useForm<TEditorContentsFormSchema>({
    defaultValues: generateDefaultValues(),
    resolver: zodResolver(ZEditorContentsFormSchema),
  });

  const {
    append,
    remove,
    update,
    fields: localContents,
  } = useFieldArray({
    control: form.control,
    name: 'contents',
    keyName: 'react-hook-form-id',
  });

  /**
   * Queue a save of the contents.
   *
   * The values are read when the save is sent rather than now, so a save
   * queued while another is in flight still carries the IDs the server
   * assigned in the meantime.
   */
  const triggerContentsUpdate = () => {
    void handleContentsUpdate(() => form.getValues().contents);
  };

  const setSelectedContent = (formId: string | null, bypassCheck = false) => {
    if (!formId) {
      setSelectedContentFormId(null);
      return;
    }

    if (bypassCheck) {
      setSelectedContentFormId(formId);
      return;
    }

    // Read the live form values rather than the render captured `localContents`
    // since this can be called from long-lived callbacks (e.g. Konva stage
    // handlers) whose closures may hold a stale content list.
    const foundContent = form.getValues().contents.find((content) => content.formId === formId);

    setSelectedContentFormId(foundContent?.formId ?? null);
  };

  /**
   * The contents sharing a page with the given content, read live from the
   * form so this is safe to call from long lived callbacks.
   */
  const getPageSiblings = (content: Pick<TLocalContent, 'envelopeItemId' | 'contentMeta'>, excludeFormId?: string) =>
    form
      .getValues()
      .contents.filter(
        (candidate) =>
          candidate.formId !== excludeFormId &&
          candidate.envelopeItemId === content.envelopeItemId &&
          (candidate.contentMeta.page ?? 1) === (content.contentMeta.page ?? 1),
      );

  /**
   * The zIndex which places a content above every other content on its page.
   */
  const getTopZIndex = (content: Pick<TLocalContent, 'envelopeItemId' | 'contentMeta'>, excludeFormId?: string) =>
    getNextContentZIndex(getPageSiblings(content, excludeFormId));

  const addContent = useCallback(
    (contentData: Omit<TLocalContent, 'formId' | 'zIndex'>): TLocalContent => {
      const content: TLocalContent = {
        ...contentData,
        formId: nanoid(12),
        contentMeta: restrictContentMetaPosValues(contentData.contentMeta),
        // New contents go on top.
        zIndex: getTopZIndex(contentData),
      };

      append(content);
      triggerContentsUpdate();
      setSelectedContent(content.formId, true);
      return content;
    },
    [append, triggerContentsUpdate, setSelectedContent],
  );

  const removeContentsByFormId = useCallback(
    (formIds: string[]) => {
      const indexes = formIds
        .map((formId) => localContents.findIndex((content) => content.formId === formId))
        .filter((index) => index !== -1);

      if (indexes.length > 0) {
        remove(indexes);
        triggerContentsUpdate();
      }
    },
    [localContents, remove, triggerContentsUpdate],
  );

  /**
   * Adopt the IDs assigned by the server after a save, without triggering
   * another save.
   *
   * The content ID is always taken from the response, since the server owns
   * row identity and a save may have replaced the row. Keeping a local ID
   * here would leave every later save pointing at a row which no longer
   * exists, which the server would then recreate over and over.
   *
   * The data content ID is different: the server may assign a different one
   * than was sent, e.g. when a duplicated content's image is cloned, so it is
   * only adopted while the local value is still the one that was sent and the
   * response of an older save cannot overwrite a newer upload.
   */
  const setContentPersistedIds = (
    formId: string,
    persisted: { id: string; dataContentId: string | null },
    sentDataContentId: string | null,
  ) => {
    const { contents } = form.getValues();

    const index = contents.findIndex((content) => content.formId === formId);

    if (index === -1) {
      return;
    }

    const current = contents[index];
    const currentDataContentId = current.dataContentId ?? null;

    const nextId = persisted.id;
    const nextDataContentId =
      currentDataContentId === sentDataContentId ? persisted.dataContentId : currentDataContentId;

    if (nextId === current.id && nextDataContentId === currentDataContentId) {
      return;
    }

    update(index, {
      ...current,
      id: nextId,
      dataContentId: nextDataContentId,
    });
  };

  /**
   * Apply updates to a content.
   *
   * Both the lookup and the write have to be against the live values: the
   * update is applied by index, so resolving the index from a render captured
   * list would write to whichever content has since moved into that slot. A
   * caller can be arbitrarily far behind, e.g. an image upload finishing
   * after its content was deleted.
   */
  const updateContentByFormId = useCallback(
    (formId: string, updates: Partial<TLocalContent>) => {
      const { contents } = form.getValues();

      const index = contents.findIndex((content) => content.formId === formId);

      if (index === -1) {
        return;
      }

      const updatedContent = {
        ...contents[index],
        ...updates,
      };

      update(index, {
        ...updatedContent,
        contentMeta: restrictContentMetaPosValues(updatedContent.contentMeta),
      });
      triggerContentsUpdate();
    },
    [form, update, triggerContentsUpdate],
  );

  const duplicateContent = useCallback(
    (content: TLocalContent): TLocalContent => {
      const newContent: TLocalContent = {
        ...structuredClone(content),
        id: undefined,
        formId: nanoid(12),
        contentMeta: restrictContentMetaPosValues(offsetContentMetaPosValues(content.contentMeta)),
        // The duplicate goes on top of the original.
        zIndex: getTopZIndex(content),
      };

      append(newContent);
      triggerContentsUpdate();
      return newContent;
    },
    [append, triggerContentsUpdate],
  );

  const duplicateContentToAllPages = useCallback(
    (content: TLocalContent): TLocalContent[] => {
      const totalPages = getPdfPagesCount();
      const newContents: TLocalContent[] = [];

      if (totalPages < 1) {
        return newContents;
      }

      for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
        if (pageNumber === content.contentMeta.page) {
          continue;
        }

        const newContentMeta = structuredClone(content.contentMeta);
        newContentMeta.page = pageNumber;

        const newContent: TLocalContent = {
          ...structuredClone(content),
          id: undefined,
          formId: nanoid(12),
          contentMeta: newContentMeta,
          zIndex: getTopZIndex({ envelopeItemId: content.envelopeItemId, contentMeta: newContentMeta }),
        };

        append(newContent);
        newContents.push(newContent);
      }

      triggerContentsUpdate();
      return newContents;
    },
    [append, triggerContentsUpdate],
  );

  /**
   * Read a content by form ID from the live values, so a caller which has
   * been waiting (e.g. an upload) sees removals which happened meanwhile.
   */
  const getContentByFormId = useCallback(
    (formId: string): TLocalContent | undefined => {
      return form.getValues().contents.find((content) => content.formId === formId);
    },
    [form],
  );

  const bringContentToFront = useCallback(
    (formId: string) => {
      const { contents } = form.getValues();
      const index = contents.findIndex((content) => content.formId === formId);

      if (index === -1) {
        return;
      }

      const content = contents[index];
      const page = getPageSiblings(content);

      // Nothing to do when it already renders last on its page. The tiebreak
      // matches how the page is rendered.
      if (
        isContentOnTop(
          page.map((candidate) => ({ id: getLocalContentOrderId(candidate), zIndex: candidate.zIndex })),
          getLocalContentOrderId(content),
        )
      ) {
        return;
      }

      update(index, {
        ...content,
        zIndex: getTopZIndex(content, formId),
      });
      triggerContentsUpdate();
    },
    [update, triggerContentsUpdate],
  );

  const selectedContent = useMemo(() => {
    return localContents.find((content) => content.formId === selectedContentFormId);
  }, [selectedContentFormId, localContents]);

  /**
   * Keep the selected content form ID in sync with the local contents.
   */
  useEffect(() => {
    const foundContent = localContents.find((content) => content.formId === selectedContentFormId);
    setSelectedContentFormId(foundContent?.formId ?? null);
  }, [selectedContentFormId, localContents]);

  const resetForm = (contents?: TEditorEnvelope['contents']) => {
    form.reset(generateDefaultValues(contents));
  };

  return {
    // Core state
    localContents,

    // Content operations
    addContent,
    setContentPersistedIds,
    removeContentsByFormId,
    updateContentByFormId,
    duplicateContent,
    duplicateContentToAllPages,

    // Content utilities
    getContentByFormId,
    bringContentToFront,

    // Selected content
    selectedContent,
    setSelectedContent,

    resetForm,
  };
};

const clampPercentage = (value: number | undefined) => {
  if (value === undefined) {
    return undefined;
  }

  return Math.max(0, Math.min(100, value));
};

/**
 * Restrict the positional values of a content meta to be within the page bounds.
 *
 * Positional values are handled per content type since they differ, e.g. lines
 * use start/end coordinates instead of a position and size.
 */
const restrictContentMetaPosValues = (contentMeta: TEnvelopeContentMetaOutput): TEnvelopeContentMetaOutput => {
  return match(contentMeta)
    .with({ type: EnvelopeContentType.LINE }, (meta) => ({
      ...meta,
      startXPosition: clampPercentage(meta.startXPosition),
      endXPosition: clampPercentage(meta.endXPosition),
      startYPosition: clampPercentage(meta.startYPosition),
      endYPosition: clampPercentage(meta.endYPosition),
    }))
    .otherwise((meta) => ({
      ...meta,
      positionX: clampPercentage(meta.positionX),
      positionY: clampPercentage(meta.positionY),
      width: clampPercentage(meta.width),
      height: clampPercentage(meta.height),
    }));
};

/**
 * Offset the position of a content meta, used when duplicating contents so the
 * duplicate does not fully overlap the original.
 */
const offsetContentMetaPosValues = (
  contentMeta: TEnvelopeContentMetaOutput,
  offset = 3,
): TEnvelopeContentMetaOutput => {
  return match(contentMeta)
    .with({ type: EnvelopeContentType.LINE }, (meta) => ({
      ...meta,
      startYPosition: (meta.startYPosition ?? 0) + offset,
      endYPosition: (meta.endYPosition ?? 0) + offset,
    }))
    .otherwise((meta) => ({
      ...meta,
      positionX: (meta.positionX ?? 0) + offset,
      positionY: (meta.positionY ?? 0) + offset,
    }));
};
