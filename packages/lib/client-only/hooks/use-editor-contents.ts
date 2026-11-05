import type { TEnvelopeContentMeta } from '@documenso/lib/types/envelope-content-meta';
import {
  EnvelopeContentType,
  getContentRotation,
  normalizeContentRotation,
  ZEnvelopeContentMetaSchema,
} from '@documenso/lib/types/envelope-content-meta';
import type { TEditorEnvelope } from '@documenso/lib/types/envelope-editor';
import { getLocalContentOrderId, getNextContentZIndex, isContentOnTop } from '@documenso/lib/utils/envelope-content';
import type { PercentageBox } from '@documenso/lib/utils/geometry';
import { clampPercentage, FIVE_DECIMAL_PLACES, roundTo } from '@documenso/lib/utils/geometry';
import { useCallback } from 'react';
import { match } from 'ts-pattern';
import { z } from 'zod';
import { EDITOR_DUPLICATE_ITEM_OFFSET } from '../../constants/envelope-editor';
import { createLocalFormId, useEditorFormArray } from './use-editor-form-array';

export const ZLocalContentSchema = z.object({
  id: z.string().optional(),
  formId: z.string().min(1),
  envelopeItemId: z.string(),
  contentMeta: ZEnvelopeContentMetaSchema,
  dataContentId: z.string().nullable(),
  // Embedded only: an image not uploaded yet, referenced by a temporary
  // `dataContentId` until the envelope is saved.
  data: z.instanceof(File).optional(),
});

export type TLocalContent = z.infer<typeof ZLocalContentSchema>;

type EditorContentsProps = {
  envelope: TEditorEnvelope;

  handleContentsUpdate: (getContents: () => TLocalContent[]) => unknown;
};

type UseEditorContentsResponse = {
  localContents: TLocalContent[];

  selectedContent: TLocalContent | undefined;
  setSelectedContent: (formId: string | null) => void;

  addContent: (content: Omit<TLocalContent, 'formId' | 'dataContentId'>) => TLocalContent;
  setContentPersistedIds: (
    formId: string,
    persisted: { id: string; dataContentId: string | null },
    sentDataContentId: string | null,
  ) => void;
  removeContentsByFormId: (formIds: string[]) => void;
  updateContentByFormId: (formId: string, updates: Partial<TLocalContent>) => void;

  /**
   * The settings form provider is the single writer of a content's
   * presentational meta. Anything else which edits those keys must go through
   * the form (e.g. `form.setValue`) rather than calling this directly, so the
   * form never falls behind the store.
   */
  patchContentMeta: (formId: string, patch: Partial<TEnvelopeContentMeta>) => void;

  duplicateContent: (content: TLocalContent) => TLocalContent;

  getContentByFormId: (formId: string) => TLocalContent | undefined;

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
      data: content.data,
    }),
    onChange: handleContentsUpdate,
  });

  const getPageSiblings = (content: Pick<TLocalContent, 'envelopeItemId' | 'contentMeta'>, excludeFormId?: string) =>
    contentsArray
      .getItems()
      .filter(
        (candidate) =>
          candidate.formId !== excludeFormId &&
          candidate.envelopeItemId === content.envelopeItemId &&
          candidate.contentMeta.page === content.contentMeta.page,
      );

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
   * The content ID is always taken from the response, since the server owns
   * row identity and a save may have replaced the row. Keeping a local ID
   * would leave every later save pointing at a row which no longer exists,
   * which the server would then recreate over and over.
   *
   * The data content ID is only adopted while the local value is still the one
   * that was sent, so the response of an older save cannot overwrite a newer
   * upload.
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
      // the cast is safe.
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
    localContents: contentsArray.items,

    addContent,
    setContentPersistedIds,
    removeContentsByFormId: contentsArray.removeByFormId,
    updateContentByFormId,
    patchContentMeta,
    duplicateContent,

    getContentByFormId: contentsArray.findItem,
    bringContentToFront,

    selectedContent: contentsArray.selectedItem,
    setSelectedContent: contentsArray.setSelected,

    resetForm: contentsArray.resetForm,
  };
};

const clampContentPercentage = (value: number) => roundTo(clampPercentage(value), FIVE_DECIMAL_PLACES);

const clampContentPercentageBox = <T extends PercentageBox>(box: T): T => ({
  ...box,
  positionX: clampContentPercentage(box.positionX),
  positionY: clampContentPercentage(box.positionY),
  width: clampContentPercentage(box.width),
  height: clampContentPercentage(box.height),
});

/**
 * Rotated footprints are not kept on the page here, since that needs the page
 * size; the canvas does it when the transform is read.
 */
const restrictContentMetaPosValues = (contentMeta: TEnvelopeContentMeta): TEnvelopeContentMeta => {
  return match(contentMeta)
    .with({ type: EnvelopeContentType.LINE }, (meta) => ({
      ...meta,
      x1: clampContentPercentage(meta.x1),
      y1: clampContentPercentage(meta.y1),
      x2: clampContentPercentage(meta.x2),
      y2: clampContentPercentage(meta.y2),
      strokeWidth: roundTo(meta.strokeWidth, FIVE_DECIMAL_PLACES),
    }))
    .with({ type: EnvelopeContentType.TEXT }, (meta) =>
      restrictBoxToPage({
        ...meta,
        fontSize: roundTo(meta.fontSize, FIVE_DECIMAL_PLACES),
        lineHeight: roundTo(meta.lineHeight, FIVE_DECIMAL_PLACES),
        letterSpacing: roundTo(meta.letterSpacing, FIVE_DECIMAL_PLACES),
      }),
    )
    .with({ type: EnvelopeContentType.SHAPE }, (meta) =>
      restrictBoxToPage({
        ...meta,
        rotation: normalizeContentRotation(meta.rotation),
        strokeWidth: roundTo(meta.strokeWidth, FIVE_DECIMAL_PLACES),
        fillOpacity: roundTo(meta.fillOpacity, FIVE_DECIMAL_PLACES),
      }),
    )
    .with({ type: EnvelopeContentType.HIGHLIGHT }, (meta) =>
      restrictBoxToPage({
        ...meta,
        fillOpacity: roundTo(meta.fillOpacity, FIVE_DECIMAL_PLACES),
      }),
    )
    .with({ type: EnvelopeContentType.IMAGE }, (meta) =>
      restrictBoxToPage({
        ...meta,
        rotation: normalizeContentRotation(meta.rotation),
      }),
    )
    .exhaustive();
};

const restrictBoxToPage = <T extends Exclude<TEnvelopeContentMeta, { type: EnvelopeContentType.LINE }>>(meta: T): T => {
  const clamped = clampContentPercentageBox(meta);

  if (getContentRotation(clamped) !== 0) {
    return clamped;
  }

  return {
    ...clamped,
    positionX: Math.min(clamped.positionX, roundTo(100 - clamped.width, FIVE_DECIMAL_PLACES)),
    positionY: Math.min(clamped.positionY, roundTo(100 - clamped.height, FIVE_DECIMAL_PLACES)),
  };
};

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
