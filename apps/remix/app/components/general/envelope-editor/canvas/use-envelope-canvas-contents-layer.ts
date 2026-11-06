import { useAnalytics } from '@documenso/lib/client-only/hooks/use-analytics';
import type { TLocalContent } from '@documenso/lib/client-only/hooks/use-editor-contents';
import { useCurrentEnvelopeEditor } from '@documenso/lib/client-only/providers/envelope-editor-provider';
import { useCurrentEnvelopeRender } from '@documenso/lib/client-only/providers/envelope-render-provider';
import type { TEnvelopeContentMeta } from '@documenso/lib/types/envelope-content-meta';
import {
  CONTENT_META_DEFAULT_VALUES,
  CONTENT_SHAPE_META_DEFAULT_VALUES_BY_SHAPE,
  EnvelopeContentShapeType,
  EnvelopeContentType,
} from '@documenso/lib/types/envelope-content-meta';
import {
  readContentGroupTransform,
  resolveContentMetaFromTransform,
} from '@documenso/lib/universal/content-renderer/content-geometry';
import {
  MIN_CONTENT_HEIGHT_PX,
  MIN_CONTENT_WIDTH_PX,
} from '@documenso/lib/universal/content-renderer/content-renderer';
import { renderContent } from '@documenso/lib/universal/content-renderer/render-content';
import { areContentsImprinted } from '@documenso/lib/utils/envelope';
import { getLocalContentOrderId, sortContentsForRender } from '@documenso/lib/utils/envelope-content';
import { getClientSideContentTranslations } from '@documenso/lib/utils/envelope-content-translations';
import type { PercentageBox } from '@documenso/lib/utils/geometry';
import { getRecipientColorStyles } from '@documenso/ui/lib/recipient-colors';
import { useLingui } from '@lingui/react/macro';
import Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { useEffect, useMemo } from 'react';

import type { ContentDragDropItem } from '../envelope-editor-content-drag-drop';
import type { EnvelopeCanvas, EnvelopeCanvasBox } from './envelope-canvas-types';
import { ENVELOPE_CANVAS_GROUP_NAMES } from './envelope-canvas-types';
import {
  getLiveEnvelopeCanvasGroups,
  reconcileEnvelopeCanvasGroups,
  syncEditorSelectionToCanvas,
} from './reconcile-envelope-canvas-groups';
import { findEnvelopeCanvasGroupsInBox } from './use-envelope-canvas-marquee';
import { useEnvelopeCanvasPendingCreation } from './use-envelope-canvas-pending-creation';
import type { EnvelopeCanvasSelectionApi } from './use-envelope-canvas-selection';

const PENDING_CONTENT_NODE_NAME = 'pending-content-creation';

type UseEnvelopeCanvasContentsLayerOptions = {
  canvas: EnvelopeCanvas;
  selection: EnvelopeCanvasSelectionApi;

  isEditable: boolean;

  isContentLimitReached: boolean;

  applyPageItemsVisibility: () => void;
};

export const useEnvelopeCanvasContentsLayer = ({
  canvas,
  selection,
  isEditable,
  isContentLimitReached,
  applyPageItemsVisibility,
}: UseEnvelopeCanvasContentsLayerOptions) => {
  const { i18n } = useLingui();
  const analytics = useAnalytics();
  const { envelope, editorContents, selectedEditorTab } = useCurrentEnvelopeEditor();
  const { version, envelopeStatus, currentEnvelopeItem, contentImages, setRenderError } = useCurrentEnvelopeRender();

  const { stage, pageLayer, scale, pageNumber, unscaledViewport } = canvas;
  const { contentGroups: selectedGroups } = selection;

  const pending = useEnvelopeCanvasPendingCreation({ canvas, nodeName: PENDING_CONTENT_NODE_NAME });

  /**
   * Once an envelope is sent its contents are inserted into the current PDF,
   * so drawing them on the canvas again would double them up.
   */
  const shouldRenderContents = !(version === 'current' && areContentsImprinted(envelopeStatus));

  const localPageContents = useMemo(() => {
    if (!shouldRenderContents) {
      return [];
    }

    return sortContentsForRender(
      editorContents.localContents
        .filter(
          (content) => content.contentMeta.page === pageNumber && content.envelopeItemId === currentEnvelopeItem?.id,
        )
        .map((content) => ({ ...content, id: getLocalContentOrderId(content) })),
      (content) => content.contentMeta.zIndex,
    );
  }, [editorContents.localContents, pageNumber, currentEnvelopeItem?.id, shouldRenderContents]);

  const isOnPage = (formId: string) => localPageContents.some((content) => content.formId === formId);

  const handleResizeOrMove = (event: KonvaEventObject<Event>) => {
    const isDragEvent = event.type === 'dragend';

    const contentGroup = event.target as Konva.Group;
    const contentFormId = contentGroup.id();

    const content = editorContents.getContentByFormId(contentFormId);

    if (!content) {
      return;
    }

    editorContents.updateContentByFormId(contentFormId, {
      contentMeta: resolveContentMetaFromTransform(
        content.contentMeta,
        readContentGroupTransform(contentGroup),
        isDragEvent ? 'drag' : 'transform',
        unscaledViewport.width,
        unscaledViewport.height,
      ),
    });

    if (isDragEvent && !selection.isSelected(contentGroup)) {
      selection.select('content', [contentGroup]);
    }

    pageLayer.current?.batchDraw();
  };

  const unsafeRenderContent = (content: TLocalContent) => {
    if (!pageLayer.current) {
      return;
    }

    const { contentGroup } = renderContent(
      {
        renderId: content.formId,
        contentMeta: content.contentMeta,
        dataContentId: content.dataContentId,
      },
      {
        pageLayer: pageLayer.current,
        pageWidth: unscaledViewport.width,
        pageHeight: unscaledViewport.height,
        scale,
        mode: 'edit',
        editable: isEditable,
        translations: getClientSideContentTranslations(i18n),
        hoverOutlineColor: getRecipientColorStyles('green').baseRing,
        images: contentImages.images,
      },
    );

    // Contents are inert while the fields tab is active so they behave as part
    // of the document.
    contentGroup.listening(isEditable);

    if (!isEditable) {
      return;
    }

    contentGroup.off('click');
    contentGroup.off('transformend');
    contentGroup.off('dragend');

    contentGroup.on('click', (event) => {
      if (event.evt.shiftKey) {
        selection.toggle('content', contentGroup);
      } else {
        selection.select('content', [contentGroup]);
      }

      pageLayer.current?.batchDraw();
    });

    contentGroup.on('transformend', handleResizeOrMove);
    contentGroup.on('dragend', handleResizeOrMove);
  };

  const renderContentOnLayer = (content: TLocalContent) => {
    try {
      unsafeRenderContent(content);
    } catch (err) {
      console.error(err);

      analytics.captureException(err, {
        source: 'editor',
        location: 'envelope_page_render',
        envelopeId: envelope.id,
      });

      setRenderError(true);
    }
  };

  /**
   * Contents always sit beneath fields as part of the document, except while
   * the contents tab is active, where they go above the muted fields so they
   * are fully visible and clickable.
   *
   * Konva stacks by child order, so the band is moved one group at a time.
   * Sending to the bottom iterates in reverse so the last content stays on
   * top, as when sending to the top in order.
   */
  const applyContentsStacking = () => {
    const layer = pageLayer.current;

    if (!layer) {
      return;
    }

    const groups = localPageContents.flatMap((content) => {
      const group = layer.findOne(`#${content.formId}`);

      return group instanceof Konva.Group ? [group] : [];
    });

    if (selectedEditorTab === 'contents') {
      for (const group of groups) {
        group.moveToTop();
      }
    } else {
      for (const group of [...groups].reverse()) {
        group.moveToBottom();
      }
    }
  };

  const renderAll = () => {
    for (const content of localPageContents) {
      renderContentOnLayer(content);
    }

    applyContentsStacking();
  };

  const selectInBox = (box: EnvelopeCanvasBox) => {
    const currentStage = stage.current;

    if (!currentStage || !isEditable) {
      return;
    }

    const groupsInBox = findEnvelopeCanvasGroupsInBox(currentStage, ENVELOPE_CANVAS_GROUP_NAMES.content, box);

    selection.select('content', groupsInBox);

    const unscaledBoxWidth = box.width / scale;
    const unscaledBoxHeight = box.height / scale;

    if (
      groupsInBox.length === 0 &&
      !isContentLimitReached &&
      unscaledBoxWidth > MIN_CONTENT_WIDTH_PX &&
      unscaledBoxHeight > MIN_CONTENT_HEIGHT_PX
    ) {
      pending.setPendingFromBox(box);
    }
  };

  const createFromPending = (item: ContentDragDropItem) => {
    const box = pending.getPendingBox();

    pending.clearPending();

    if (!box || !currentEnvelopeItem) {
      return;
    }

    editorContents.addContent({
      envelopeItemId: currentEnvelopeItem.id,
      contentMeta: buildContentMetaFromBox(item, pageNumber, box),
    });
  };

  // A failed image keeps its placeholder so the author can re-upload.
  useEffect(() => {
    const layer = pageLayer.current;

    if (!layer || !stage.current) {
      return;
    }

    reconcileEnvelopeCanvasGroups({
      layer,
      groupName: ENVELOPE_CANVAS_GROUP_NAMES.content,
      items: localPageContents,
      getRenderId: (content) => content.formId,
      render: renderContentOnLayer,
    });

    applyContentsStacking();

    const liveSelectedGroups = getLiveEnvelopeCanvasGroups(selectedGroups, isOnPage);

    if (liveSelectedGroups.length !== selectedGroups.length) {
      selection.select('content', liveSelectedGroups);
    }

    // Only sync while editable, otherwise a transformer would be attached
    // to an inert group.
    if (isEditable) {
      syncEditorSelectionToCanvas({
        layer,
        kind: 'content',
        editorFormId: editorContents.selectedContent?.formId ?? null,
        isOnPage,
        selectedGroups,
        select: selection.select,
        clear: selection.clear,
      });
    }

    applyPageItemsVisibility();

    selection.refreshTransformer();

    layer.batchDraw();
  }, [
    localPageContents,
    selectedGroups,
    selectedEditorTab,
    isEditable,
    editorContents.selectedContent?.formId,
    contentImages.images,
  ]);

  // So the content being worked on is never hidden behind another.
  useEffect(() => {
    if (isEditable && selectedGroups.length === 1) {
      editorContents.bringContentToFront(selectedGroups[0].id());
    }
  }, [isEditable, selectedGroups]);

  useEffect(() => {
    if (!isEditable && (selectedGroups.length > 0 || pending.pendingCreation)) {
      pending.clearPending();
      selection.clear();
      pageLayer.current?.batchDraw();
    }
  }, [isEditable, selectedGroups, pending.pendingCreation]);

  const getSelectedContents = () =>
    selectedGroups
      .map((group) => editorContents.getContentByFormId(group.id()))
      .filter((content) => content !== undefined);

  const deleteSelected = () => {
    editorContents.removeContentsByFormId(selectedGroups.map((group) => group.id()));

    selection.clear();
  };

  const duplicateSelected = () => {
    for (const content of getSelectedContents()) {
      editorContents.duplicateContent(content);
    }
  };

  return {
    localPageContents,
    renderAll,
    selectInBox,
    pendingCreation: pending.pendingCreation,
    createFromPending,
    clearPending: pending.clearPending,
    deleteSelected,
    duplicateSelected,
  };
};

const buildContentMetaFromBox = (item: ContentDragDropItem, page: number, box: PercentageBox): TEnvelopeContentMeta => {
  const defaultMeta =
    item.type === EnvelopeContentType.SHAPE
      ? CONTENT_SHAPE_META_DEFAULT_VALUES_BY_SHAPE[item.shape ?? EnvelopeContentShapeType.RECTANGLE]
      : CONTENT_META_DEFAULT_VALUES[item.type];

  const meta = { ...structuredClone(defaultMeta), page };

  if (meta.type === EnvelopeContentType.LINE) {
    return {
      ...meta,
      x1: box.positionX,
      y1: box.positionY,
      x2: box.positionX + box.width,
      y2: box.positionY,
    };
  }

  return {
    ...meta,
    positionX: box.positionX,
    positionY: box.positionY,
    width: box.width,
    height: box.height,
  };
};
