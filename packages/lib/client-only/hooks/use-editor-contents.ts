import type { TEnvelopeContentMeta } from '@documenso/lib/types/envelope-content-meta';
import { EnvelopeContentType, ZEnvelopeContentMetaSchema } from '@documenso/lib/types/envelope-content-meta';
import type { TEditorEnvelope } from '@documenso/lib/types/envelope-editor';
import { getLocalContentOrderId, getNextContentZIndex, isContentOnTop } from '@documenso/lib/utils/envelope-content';
import { clampPercentage, clampPercentageBox } from '@documenso/lib/utils/geometry';
import { useCallback } from 'react';
import { match } from 'ts-pattern';
import { z } from 'zod';
import { EDITOR_DUPLICATE_ITEM_OFFSET } from '../../constants/envelope-editor';
import { createLocalFormId, useEditorFormArray } from './use-editor-form-array';

/**
 * The local editor representation of an envelope content.
 *
 * Note: Unlike fields, geometry (page, position, size and stacking order) is
 * stored within the content meta since it differs per content type, e.g.
 * lines use start/end coordinates instead of a position and size.
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
  // the content, or null for none.
  dataContentId: z.string().nullable(),
});

export type TLocalContent = z.infer<typeof ZLocalContentSchema>;

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
  /**
   * Add a content. It is placed above every other content on its page.
   */
  addContent: (content: Omit<TLocalContent, 'formId' | 'dataContentId'>) => TLocalContent;
  setContentPersistedIds: (
    formId: string,
    persisted: { id: string; dataContentId: string | null },
    sentDataContentId: string | null,
  ) => void;
  removeContentsByFormId: (formIds: string[]) => void;
  updateContentByFormId: (formId: string, updates: Partial<TLocalContent>) => void;

  /**
   * Merge a partial meta onto a content's current meta.
   *
   * The settings form provider is the single writer of a content's
   * presentational meta. Anything else which edits those keys must go through
   * the form (e.g. `form.setValue`) rather than calling this directly, so the
   * form never falls behind the store.
   */
  patchContentMeta: (formId: string, patch: Partial<TEnvelopeContentMeta>) => void;

  duplicateContent: (content: TLocalContent) => TLocalContent;

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
  const contentsArray = useEditorFormArray<TLocalContent, TEditorEnvelope['contents'][number]>({
    schema: ZLocalContentSchema,
    sources: envelope.contents,
    mapSource: (content) => ({
      id: content.id,
      envelopeItemId: content.envelopeItemId,
      contentMeta: content.contentMeta,
      dataContentId: content.dataContentId,
    }),
    onChange: handleContentsUpdate,
  });

  /**
   * The contents sharing a page with the given content, read live from the
   * form so this is safe to call from long lived callbacks.
   */
  const getPageSiblings = (content: Pick<TLocalContent, 'envelopeItemId' | 'contentMeta'>, excludeFormId?: string) =>
    contentsArray
      .getItems()
      .filter(
        (candidate) =>
          candidate.formId !== excludeFormId &&
          candidate.envelopeItemId === content.envelopeItemId &&
          candidate.contentMeta.page === content.contentMeta.page,
      );

  /**
   * The zIndex which places a content above every other content on its page.
   */
  const getTopZIndex = (content: Pick<TLocalContent, 'envelopeItemId' | 'contentMeta'>, excludeFormId?: string) =>
    getNextContentZIndex(getPageSiblings(content, excludeFormId).map((sibling) => sibling.contentMeta.zIndex));

  const addContent = useCallback(
    (contentData: Omit<TLocalContent, 'formId' | 'dataContentId'>): TLocalContent => {
      const content: TLocalContent = {
        ...contentData,
        formId: createLocalFormId(),
        dataContentId: null,
        contentMeta: {
          ...restrictContentMetaPosValues(contentData.contentMeta),
          // New contents go on top.
          zIndex: getTopZIndex(contentData),
        },
      };

      contentsArray.appendItems([content]);
      contentsArray.setSelected(content.formId, true);

      return content;
    },
    [contentsArray.appendItems, contentsArray.setSelected],
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
    contentsArray.updateByFormId(
      formId,
      (current) => {
        const currentDataContentId = current.dataContentId;

        const nextDataContentId =
          currentDataContentId === sentDataContentId ? persisted.dataContentId : currentDataContentId;

        if (persisted.id === current.id && nextDataContentId === currentDataContentId) {
          return current;
        }

        return { ...current, id: persisted.id, dataContentId: nextDataContentId };
      },
      { shouldTriggerChange: false },
    );
  };

  const updateContentByFormId = useCallback(
    (formId: string, updates: Partial<TLocalContent>) => {
      contentsArray.updateByFormId(formId, (content) => {
        const updated = { ...content, ...updates };

        return { ...updated, contentMeta: restrictContentMetaPosValues(updated.contentMeta) };
      });
    },
    [contentsArray.updateByFormId],
  );

  const patchContentMeta = useCallback(
    (formId: string, patch: Partial<TEnvelopeContentMeta>) => {
      const content = contentsArray.findItem(formId);

      if (!content) {
        return;
      }

      // The patch only ever carries keys valid for the content's own type, so
      // the merge keeps the discriminant intact.
      const contentMeta = { ...content.contentMeta, ...patch } as TEnvelopeContentMeta;

      updateContentByFormId(formId, { contentMeta });
    },
    [contentsArray.findItem, updateContentByFormId],
  );

  const duplicateContent = useCallback(
    (content: TLocalContent): TLocalContent => {
      const newContent: TLocalContent = {
        ...structuredClone(content),
        id: undefined,
        formId: createLocalFormId(),
        contentMeta: {
          ...restrictContentMetaPosValues(offsetContentMetaPosValues(content.contentMeta)),
          // The duplicate goes on top of the original.
          zIndex: getTopZIndex(content),
        },
      };

      contentsArray.appendItems([newContent]);

      return newContent;
    },
    [contentsArray.appendItems],
  );

  const bringContentToFront = useCallback(
    (formId: string) => {
      contentsArray.updateByFormId(formId, (content) => {
        const page = getPageSiblings(content);

        // Nothing to do when it already renders last on its page. The
        // tiebreak matches how the page is rendered.
        const isAlreadyOnTop = isContentOnTop(
          page.map((candidate) => ({ id: getLocalContentOrderId(candidate), zIndex: candidate.contentMeta.zIndex })),
          getLocalContentOrderId(content),
        );

        if (isAlreadyOnTop) {
          return content;
        }

        return {
          ...content,
          contentMeta: { ...content.contentMeta, zIndex: getTopZIndex(content, formId) },
        };
      });
    },
    [contentsArray.updateByFormId],
  );

  return {
    // Core state
    localContents: contentsArray.items,

    // Content operations
    addContent,
    setContentPersistedIds,
    removeContentsByFormId: contentsArray.removeByFormId,
    updateContentByFormId,
    patchContentMeta,
    duplicateContent,

    // Content utilities
    getContentByFormId: contentsArray.findItem,
    bringContentToFront,

    // Selected content
    selectedContent: contentsArray.selectedItem,
    setSelectedContent: contentsArray.setSelected,

    resetForm: contentsArray.resetForm,
  };
};

/**
 * Restrict the positional values of a content meta to be within the page bounds.
 *
 * Positional values are handled per content type since they differ, e.g. lines
 * use start/end coordinates instead of a position and size.
 */
const restrictContentMetaPosValues = (contentMeta: TEnvelopeContentMeta): TEnvelopeContentMeta => {
  return match(contentMeta)
    .with({ type: EnvelopeContentType.LINE }, (meta) => ({
      ...meta,
      x1: clampPercentage(meta.x1),
      y1: clampPercentage(meta.y1),
      x2: clampPercentage(meta.x2),
      y2: clampPercentage(meta.y2),
    }))
    .otherwise((meta) => clampPercentageBox(meta));
};

/**
 * Offset the position of a content meta, used when duplicating contents so the
 * duplicate does not fully overlap the original.
 */
const offsetContentMetaPosValues = (
  contentMeta: TEnvelopeContentMeta,
  offset = EDITOR_DUPLICATE_ITEM_OFFSET,
): TEnvelopeContentMeta => {
  return match(contentMeta)
    .with({ type: EnvelopeContentType.LINE }, (meta) => ({
      ...meta,
      y1: meta.y1 + offset,
      y2: meta.y2 + offset,
    }))
    .otherwise((meta) => ({
      ...meta,
      positionX: meta.positionX + offset,
      positionY: meta.positionY + offset,
    }));
};
