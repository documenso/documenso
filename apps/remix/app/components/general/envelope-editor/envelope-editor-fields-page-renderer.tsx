import { usePageRenderer } from '@documenso/lib/client-only/hooks/use-page-renderer';
import { useCurrentEnvelopeEditor } from '@documenso/lib/client-only/providers/envelope-editor-provider';
import {
  type PageRenderData,
  useCurrentEnvelopeRender,
} from '@documenso/lib/client-only/providers/envelope-render-provider';
import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { EnvelopeContentType } from '@documenso/lib/types/envelope-content-meta';
import { getContentTransformerConfig } from '@documenso/lib/universal/content-renderer/content-geometry';
import { DEFAULT_TRANSFORMER_SELECTION_CONFIG } from '@documenso/lib/universal/konva/transformer';
import { canContentBeChanged } from '@documenso/lib/utils/envelope';
import { resolveEnvelopeContentLimits } from '@documenso/lib/utils/envelope-content';
import { useLingui } from '@lingui/react/macro';
import type Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { CopyPlusIcon, TrashIcon } from 'lucide-react';
import { match } from 'ts-pattern';
import {
  EnvelopeCanvasActionBar,
  EnvelopeCanvasActionButton,
  EnvelopeCanvasActionButtonGroup,
} from './canvas/envelope-canvas-action-bar';
import { EnvelopeCanvasContentActions } from './canvas/envelope-canvas-content-actions';
import { EnvelopeCanvasFieldActionButtons } from './canvas/envelope-canvas-field-action-buttons';
import { EnvelopeCanvasPendingContentMenu } from './canvas/envelope-canvas-pending-content-menu';
import { EnvelopeCanvasPendingFieldMenu } from './canvas/envelope-canvas-pending-field-menu';
import type {
  EnvelopeCanvas,
  EnvelopeCanvasSelection,
  EnvelopeCanvasSelectionKind,
} from './canvas/envelope-canvas-types';
import { ENVELOPE_CANVAS_GROUP_NAMES } from './canvas/envelope-canvas-types';
import { useEnvelopeCanvasContentsLayer } from './canvas/use-envelope-canvas-contents-layer';
import { useEnvelopeCanvasFieldsLayer } from './canvas/use-envelope-canvas-fields-layer';
import { useEnvelopeCanvasLineAnchors } from './canvas/use-envelope-canvas-line-anchors';
import { useEnvelopeCanvasMarquee } from './canvas/use-envelope-canvas-marquee';
import { useEnvelopeCanvasSelection } from './canvas/use-envelope-canvas-selection';
import { contentButtonList } from './envelope-editor-content-drag-drop';

/**
 * Resolve the selectable kind of a Konva node, if any.
 */
const getNodeSelectionKind = (node: Konva.Node): EnvelopeCanvasSelectionKind | null => {
  if (node.hasName(ENVELOPE_CANVAS_GROUP_NAMES.field)) {
    return 'field';
  }

  if (node.hasName(ENVELOPE_CANVAS_GROUP_NAMES.content)) {
    return 'content';
  }

  return null;
};

export const EnvelopeEditorFieldsPageRenderer = ({ pageData }: { pageData: PageRenderData }) => {
  const { t } = useLingui();
  const { envelope, editorFields, editorContents, selectedEditorTab } = useCurrentEnvelopeEditor();
  const { currentEnvelopeItem } = useCurrentEnvelopeRender();
  const organisation = useCurrentOrganisation();

  const { scale, pageNumber } = pageData;

  const { isContentLimitReached, isImageLimitReached } = resolveEnvelopeContentLimits(
    editorContents.localContents.map((content) => content.contentMeta.type),
    organisation.organisationClaim,
  );

  const {
    stage,
    pageLayer,
    konvaContainer,
    scaledViewport,
    unscaledViewport,
    fieldsVisibility,
    contentsVisibility,
    applyPageItemsVisibility,
  } = usePageRenderer(({ stage, pageLayer }) => createPageCanvas(stage, pageLayer), pageData, {
    // Mute the fields while contents are being edited.
    fieldsVisibility: selectedEditorTab === 'contents' ? 'muted' : 'visible',
  });

  const canvas: EnvelopeCanvas = { stage, pageLayer, scale, pageNumber, unscaledViewport, scaledViewport };

  /**
   * Whether contents can currently be edited on the canvas.
   */
  const isContentsEditable =
    selectedEditorTab === 'contents' && canContentBeChanged(envelope) && contentsVisibility === 'visible';

  /**
   * Keep the editor's selected field/content in sync with the canvas selection.
   */
  const syncEditorSelection = (selection: EnvelopeCanvasSelection) => {
    const singleFormId = selection?.groups.length === 1 ? selection.groups[0].id() : null;

    editorFields.setSelectedField(selection?.kind === 'field' ? singleFormId : null);
    editorContents.setSelectedContent(selection?.kind === 'content' ? singleFormId : null);
  };

  const selection = useEnvelopeCanvasSelection({
    getTransformerConfig: (kind, groups) => {
      if (kind === 'field') {
        return DEFAULT_TRANSFORMER_SELECTION_CONFIG;
      }

      const selectedContents = groups.map((group) => editorContents.getContentByFormId(group.id()));

      return getContentTransformerConfig(
        selectedContents.map((content) => content?.contentMeta.type),
        { hasImage: selectedContents.length === 1 && Boolean(selectedContents[0]?.dataContentId) },
      );
    },
    onChange: syncEditorSelection,
  });

  const fields = useEnvelopeCanvasFieldsLayer({ canvas, selection, fieldsVisibility, applyPageItemsVisibility });

  const contents = useEnvelopeCanvasContentsLayer({
    canvas,
    selection,
    isEditable: isContentsEditable,
    isContentLimitReached,
    applyPageItemsVisibility,
  });

  const lineAnchors = useEnvelopeCanvasLineAnchors({
    canvas,
    selection,
    isEditable: isContentsEditable,
    localPageContents: contents.localPageContents,
  });

  const marquee = useEnvelopeCanvasMarquee({
    // While editing contents the marquee selects contents instead of fields.
    onSelect: (box) => (isContentsEditable ? contents.selectInBox(box) : fields.selectInBox(box)),
    onEmptyClick: selection.clear,
  });

  /**
   * Initialize the Konva page canvas and all fields, contents and interactions.
   */
  const createPageCanvas = (currentStage: Konva.Stage, currentPageLayer: Konva.Layer) => {
    selection.attach(currentPageLayer);

    // Render the contents first so they sit beneath the fields.
    contents.renderAll();
    fields.renderAll();

    // The stage is rebuilt on zoom, so anything selected beforehand is now
    // pointing at the nodes which were just thrown away.
    selection.reattachSelection(currentPageLayer);

    marquee.bind(currentStage, currentPageLayer);

    // Clicking an empty area of the stage deselects.
    currentStage.on('mousedown', (e) => {
      fields.clearPending();
      contents.clearPending();

      if (e.target === currentStage) {
        selection.clear();
        currentPageLayer.batchDraw();
      }
    });

    // When an item is dragged, select it automatically.
    const onDragStartOrEnd = (e: KonvaEventObject<Event>) => {
      fields.clearPending();
      contents.clearPending();

      const kind = getNodeSelectionKind(e.target);

      if (!kind) {
        return;
      }

      selection.setIsTransforming(e.type === 'dragstart');

      // Do nothing and allow the transformer to handle it.
      // Required so when multiple items are selected, this won't deselect them.
      if (selection.isSelected(e.target)) {
        return;
      }

      selection.select(kind, [e.target]);
    };

    currentStage.on('dragstart', onDragStartOrEnd);
    currentStage.on('dragend', onDragStartOrEnd);

    currentPageLayer.batchDraw();
  };

  if (!currentEnvelopeItem) {
    return null;
  }

  const { selection: currentSelection, isTransforming } = selection;

  /**
   * The selected content when exactly one is selected. Type specific quick
   * actions (styles, image upload) are only offered for single selections.
   */
  const selectedSingleContent = match(currentSelection)
    .with({ kind: 'content' }, ({ groups }) =>
      groups.length === 1 ? (editorContents.getContentByFormId(groups[0].id()) ?? null) : null,
    )
    .otherwise(() => null);

  const selectedContents = match(currentSelection)
    .with({ kind: 'content' }, ({ groups }) =>
      groups.flatMap((group) => editorContents.getContentByFormId(group.id()) ?? []),
    )
    .otherwise(() => []);

  /**
   * Duplicating adds a copy of every selected content, so it is offered only
   * while the organisation's allowance has room for them.
   */
  const canSelectionBeDuplicated =
    !isContentLimitReached &&
    !(
      isImageLimitReached && selectedContents.some((content) => content.contentMeta.type === EnvelopeContentType.IMAGE)
    );

  /**
   * The contents which can be created from a drawn box. Image contents have
   * their own allowance, so they are left out once it is used up.
   */
  const creatableContentItems = contentButtonList.filter(
    (item) => !isImageLimitReached || item.type !== EnvelopeContentType.IMAGE,
  );

  return (
    <>
      {currentSelection?.kind === 'field' && (
        <EnvelopeCanvasActionBar nodes={currentSelection.groups} hidden={isTransforming || currentSelection.isAuto}>
          <EnvelopeCanvasFieldActionButtons
            selectedFieldFormIds={currentSelection.groups.map((group) => group.id())}
            onDuplicate={fields.duplicateSelected}
            onDuplicateOnAllPages={fields.duplicateSelectedOnAllPages}
            onDelete={fields.deleteSelected}
            onChangeRecipient={fields.changeSelectedRecipient}
            onChangeFieldType={fields.changeSelectedType}
          />
        </EnvelopeCanvasActionBar>
      )}

      {currentSelection?.kind === 'content' && (
        <EnvelopeCanvasActionBar nodes={currentSelection.groups} hidden={isTransforming || lineAnchors.isDragging}>
          <EnvelopeCanvasActionButtonGroup>
            {selectedSingleContent && <EnvelopeCanvasContentActions content={selectedSingleContent} />}

            {/* Duplicating adds a content, so it is hidden once the organisation's allowance is used up. */}
            {canSelectionBeDuplicated && (
              <EnvelopeCanvasActionButton
                title={t`Duplicate`}
                icon={CopyPlusIcon}
                onClick={contents.duplicateSelected}
              />
            )}

            <EnvelopeCanvasActionButton title={t`Remove`} icon={TrashIcon} onClick={contents.deleteSelected} />
          </EnvelopeCanvasActionButtonGroup>
        </EnvelopeCanvasActionBar>
      )}

      {fields.pendingCreation && (
        <EnvelopeCanvasActionBar nodes={[fields.pendingCreation]}>
          <EnvelopeCanvasPendingFieldMenu onSelectType={fields.createFromPending} />
        </EnvelopeCanvasActionBar>
      )}

      {contents.pendingCreation && (
        <EnvelopeCanvasActionBar nodes={[contents.pendingCreation]}>
          <EnvelopeCanvasPendingContentMenu items={creatableContentItems} onSelectItem={contents.createFromPending} />
        </EnvelopeCanvasActionBar>
      )}

      {/* The element Konva will inject it's canvas into. */}
      <div className="konva-container absolute inset-0 z-10 w-full" ref={konvaContainer}></div>
    </>
  );
};
