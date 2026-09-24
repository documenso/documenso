import { useAnalytics } from '@documenso/lib/client-only/hooks/use-analytics';
import { useDebouncedValue } from '@documenso/lib/client-only/hooks/use-debounced-value';
import type { TLocalField } from '@documenso/lib/client-only/hooks/use-editor-fields';
import { useCurrentEnvelopeEditor } from '@documenso/lib/client-only/providers/envelope-editor-provider';
import { useCurrentEnvelopeRender } from '@documenso/lib/client-only/providers/envelope-render-provider';
import type { EnvelopePageItemsVisibility } from '@documenso/lib/types/envelope-page-items-visibility';
import { FIELD_META_DEFAULT_VALUES } from '@documenso/lib/types/field-meta';
import { MIN_FIELD_HEIGHT_PX, MIN_FIELD_WIDTH_PX } from '@documenso/lib/universal/field-renderer/field-renderer';
import { renderField } from '@documenso/lib/universal/field-renderer/render-field';
import { getClientSideFieldTranslations } from '@documenso/lib/utils/fields';
import { getOverlappingFieldPairs } from '@documenso/lib/utils/fields-overlap';
import { canRecipientFieldsBeModified } from '@documenso/lib/utils/recipients';
import { useLingui } from '@lingui/react/macro';
import type { FieldType } from '@prisma/client';
import Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { useEffect, useMemo } from 'react';

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

const PENDING_FIELD_NODE_NAME = 'pending-field-creation';

type UseEnvelopeCanvasFieldsLayerOptions = {
  canvas: EnvelopeCanvas;
  selection: EnvelopeCanvasSelectionApi;
  fieldsVisibility: EnvelopePageItemsVisibility;
  applyPageItemsVisibility: () => void;
};

/**
 * Renders and manages the fields of the current page on the canvas.
 *
 * Owns field rendering, overlap highlighting, geometry write back, the
 * marquee-to-create flow and the selection actions for fields.
 */
export const useEnvelopeCanvasFieldsLayer = ({
  canvas,
  selection,
  fieldsVisibility,
  applyPageItemsVisibility,
}: UseEnvelopeCanvasFieldsLayerOptions) => {
  const { i18n } = useLingui();
  const analytics = useAnalytics();
  const { envelope, editorFields, getRecipientColorKey } = useCurrentEnvelopeEditor();
  const { currentEnvelopeItem, setRenderError } = useCurrentEnvelopeRender();

  const { stage, pageLayer, scale, pageNumber, unscaledViewport, scaledViewport } = canvas;
  const { fieldGroups: selectedGroups, isTransforming } = selection;

  /**
   * The rectangle drawn via the marquee which is pending a field type choice.
   */
  const pending = useEnvelopeCanvasPendingCreation({ canvas, nodeName: PENDING_FIELD_NODE_NAME });

  const localPageFields = useMemo(
    () =>
      editorFields.localFields.filter(
        (field) => field.page === pageNumber && field.envelopeItemId === currentEnvelopeItem?.id,
      ),
    [editorFields.localFields, pageNumber, currentEnvelopeItem?.id],
  );

  const isOnPage = (formId: string) => localPageFields.some((field) => field.formId === formId);

  /**
   * Debounce the fields used for overlap highlighting so we don't recompute on every
   * small drag/resize tick. Overlaps only occur within the same page and envelope
   * item, so computing from this page's fields alone is sufficient.
   */
  const debouncedPageFields = useDebouncedValue(localPageFields, 300);

  const overlappingFieldFormIds = useMemo(() => {
    const formIds = new Set<string>();

    const pairs = getOverlappingFieldPairs(
      debouncedPageFields.map((field) => ({
        id: field.formId,
        envelopeItemId: field.envelopeItemId,
        page: field.page,
        positionX: field.positionX,
        positionY: field.positionY,
        width: field.width,
        height: field.height,
      })),
    );

    for (const pair of pairs) {
      formIds.add(pair.fieldA.id);
      formIds.add(pair.fieldB.id);
    }

    return formIds;
  }, [debouncedPageFields]);

  /**
   * Write the new geometry of a field back after a drag or resize gesture.
   */
  const handleResizeOrMove = (event: KonvaEventObject<Event>) => {
    const isDragEvent = event.type === 'dragend';

    const fieldGroup = event.target as Konva.Group;
    const fieldFormId = fieldGroup.id();

    // Note: This values are scaled.
    const {
      width: fieldPixelWidth,
      height: fieldPixelHeight,
      x: fieldX,
      y: fieldY,
    } = fieldGroup.getClientRect({
      skipStroke: true,
      skipShadow: true,
    });

    const pageHeight = scaledViewport.height;
    const pageWidth = scaledViewport.width;

    // Calculate x and y as a percentage of the page width and height
    const positionPercentX = (fieldX / pageWidth) * 100;
    const positionPercentY = (fieldY / pageHeight) * 100;

    // Get the bounds as a percentage of the page width and height
    const fieldPageWidth = (fieldPixelWidth / pageWidth) * 100;
    const fieldPageHeight = (fieldPixelHeight / pageHeight) * 100;

    const fieldUpdates: Partial<TLocalField> = {
      positionX: positionPercentX,
      positionY: positionPercentY,
    };

    // Do not update the width/height unless the field has actually been resized.
    // This is because our calculations will shift the width/height slightly
    // due to the way we convert between pixel and percentage.
    if (!isDragEvent) {
      fieldUpdates.width = fieldPageWidth;
      fieldUpdates.height = fieldPageHeight;
    }

    editorFields.updateFieldByFormId(fieldFormId, fieldUpdates);

    // Select the field if it is not already selected.
    if (isDragEvent && !selection.isSelected(fieldGroup)) {
      selection.select('field', [fieldGroup]);
    }

    pageLayer.current?.batchDraw();
  };

  /**
   * Draws (or removes) a dashed warning outline over a field that significantly
   * overlaps another field. The highlight is a child of the field group so it moves
   * and resizes with the field, and sits on top of the field's own rect (which is
   * re-styled on every render and would otherwise clobber a direct stroke change).
   */
  const syncOverlapHighlight = (fieldGroup: Konva.Group, isOverlapping: boolean) => {
    const existingHighlight = fieldGroup.findOne('.field-overlap-highlight');

    // Skip while a field is actively being dragged/resized. The highlight is driven
    // by debounced field data, so it would lag behind and distort during the gesture.
    // It is repainted once the gesture settles (the effect re-runs on isTransforming).
    if (isTransforming || !isOverlapping) {
      existingHighlight?.destroy();
      return;
    }

    const fieldRect = fieldGroup.findOne('.field-rect');

    if (!fieldRect) {
      return;
    }

    const highlightAttrs = {
      x: 0,
      y: 0,
      width: fieldRect.width(),
      height: fieldRect.height(),
      stroke: '#f59e0b',
      strokeWidth: 2,
      dash: [6, 4],
      cornerRadius: 2,
      strokeScaleEnabled: false,
      listening: false,
    } satisfies Partial<Konva.RectConfig>;

    if (existingHighlight instanceof Konva.Rect) {
      existingHighlight.setAttrs(highlightAttrs);
      existingHighlight.moveToTop();
      return;
    }

    const highlight = new Konva.Rect({
      name: 'field-overlap-highlight',
      ...highlightAttrs,
    });

    fieldGroup.add(highlight);
    highlight.moveToTop();
  };

  const unsafeRenderField = (field: TLocalField) => {
    if (!pageLayer.current) {
      return;
    }

    // Muted fields are rendered with the read-only styling and cannot be
    // edited, mirroring how other recipients' fields look during signing.
    const isMuted = fieldsVisibility === 'muted';

    const recipient = envelope.recipients.find((r) => r.id === field.recipientId);

    const isFieldEditable =
      !isMuted && recipient !== undefined && canRecipientFieldsBeModified(recipient, envelope.fields);

    const { fieldGroup } = renderField({
      scale,
      pageLayer: pageLayer.current,
      field: {
        renderId: field.formId,
        ...field,
        customText: '',
        inserted: false,
        fieldMeta: field.fieldMeta,
      },
      translations: getClientSideFieldTranslations(i18n),
      pageWidth: unscaledViewport.width,
      pageHeight: unscaledViewport.height,
      color: isMuted ? 'readOnly' : getRecipientColorKey(field.recipientId),
      editable: isFieldEditable,
      mode: 'edit',
    });

    syncOverlapHighlight(fieldGroup, overlappingFieldFormIds.has(field.formId));

    if (!isFieldEditable) {
      return;
    }

    fieldGroup.off('click');
    fieldGroup.off('transformend');
    fieldGroup.off('dragend');

    // A plain click selects just this field, shift + click toggles it in/out
    // of the current selection.
    fieldGroup.on('click', (event) => {
      pending.clearPending();

      if (event.evt.shiftKey) {
        selection.toggle('field', fieldGroup);
      } else {
        selection.select('field', [fieldGroup]);
      }

      pageLayer.current?.batchDraw();
    });

    fieldGroup.on('transformend', handleResizeOrMove);
    fieldGroup.on('dragend', handleResizeOrMove);
  };

  const renderFieldOnLayer = (field: TLocalField) => {
    try {
      unsafeRenderField(field);
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
   * Render every field on the page. Called when the page canvas is created.
   */
  const renderAll = () => {
    for (const field of localPageFields) {
      renderFieldOnLayer(field);
    }
  };

  /**
   * Resolve a marquee selection box into a field selection, or into a pending
   * field creation when nothing was selected and the box is large enough.
   */
  const selectInBox = (box: EnvelopeCanvasBox) => {
    const currentStage = stage.current;

    if (!currentStage) {
      return;
    }

    // While fields are hidden they cannot be selected or created.
    if (fieldsVisibility !== 'visible') {
      return;
    }

    const groupsInBox = findEnvelopeCanvasGroupsInBox(currentStage, ENVELOPE_CANVAS_GROUP_NAMES.field, box);

    selection.select('field', groupsInBox);

    const unscaledBoxWidth = box.width / scale;
    const unscaledBoxHeight = box.height / scale;

    // Create a field if no items are selected or the size is too small.
    if (
      groupsInBox.length === 0 &&
      unscaledBoxWidth > MIN_FIELD_WIDTH_PX &&
      unscaledBoxHeight > MIN_FIELD_HEIGHT_PX &&
      editorFields.selectedRecipient &&
      canRecipientFieldsBeModified(editorFields.selectedRecipient, envelope.fields)
    ) {
      pending.setPendingFromBox(box);
    }
  };

  /**
   * Create a field of the given type from the pending creation rectangle.
   */
  const createFromPending = (type: FieldType) => {
    const box = pending.getPendingBox();

    pending.clearPending();

    if (!box || !currentEnvelopeItem || !editorFields.selectedRecipient) {
      return;
    }

    editorFields.addField({
      envelopeItemId: currentEnvelopeItem.id,
      page: pageNumber,
      type,
      positionX: box.positionX,
      positionY: box.positionY,
      width: box.width,
      height: box.height,
      recipientId: editorFields.selectedRecipient.id,
      fieldMeta: structuredClone(FIELD_META_DEFAULT_VALUES[type]),
    });
  };

  /**
   * Render fields when they are added, removed or updated.
   */
  useEffect(() => {
    const layer = pageLayer.current;

    if (!layer || !stage.current) {
      return;
    }

    reconcileEnvelopeCanvasGroups({
      layer,
      groupName: ENVELOPE_CANVAS_GROUP_NAMES.field,
      items: localPageFields,
      getRenderId: (field) => field.formId,
      render: renderFieldOnLayer,
    });

    // Reconcile selection state with live field nodes after flush/sync updates.
    const liveSelectedGroups = getLiveEnvelopeCanvasGroups(selectedGroups, isOnPage);

    if (liveSelectedGroups.length !== selectedGroups.length) {
      selection.select('field', liveSelectedGroups);
    }

    // Newly created fields are auto selected, which suppresses the action bar
    // so it can't intercept the next placement click.
    syncEditorSelectionToCanvas({
      layer,
      kind: 'field',
      editorFormId: editorFields.selectedField?.formId ?? null,
      isOnPage,
      selectedGroups,
      select: selection.select,
      clear: selection.clear,
      isAuto: true,
    });

    applyPageItemsVisibility();

    selection.refreshTransformerConfig();

    layer.batchDraw();
  }, [
    localPageFields,
    selectedGroups,
    overlappingFieldFormIds,
    isTransforming,
    editorFields.selectedField?.formId,
    fieldsVisibility,
  ]);

  /**
   * Clear any active selection and pending field creation when fields are no
   * longer visible, since the transformer and floating toolbars would
   * otherwise remain anchored to hidden fields.
   */
  useEffect(() => {
    if (fieldsVisibility !== 'visible' && (selectedGroups.length > 0 || pending.pendingCreation)) {
      pending.clearPending();
      selection.clear();
      pageLayer.current?.batchDraw();
    }
  }, [fieldsVisibility, selectedGroups, pending.pendingCreation]);

  const getSelectedFields = () =>
    selectedGroups.map((group) => editorFields.getFieldByFormId(group.id())).filter((field) => field !== undefined);

  const deleteSelected = () => {
    editorFields.removeFieldsByFormId(selectedGroups.map((group) => group.id()));

    selection.clear();
  };

  const duplicateSelected = () => {
    for (const field of getSelectedFields()) {
      editorFields.duplicateField(field);
    }
  };

  const duplicateSelectedOnAllPages = () => {
    for (const field of getSelectedFields()) {
      editorFields.duplicateFieldToAllPages(field);
    }

    selection.clear();
  };

  const changeSelectedRecipient = (recipientId: number) => {
    for (const field of getSelectedFields()) {
      if (field.recipientId !== recipientId) {
        editorFields.updateFieldByFormId(field.formId, { recipientId, id: undefined });
      }
    }
  };

  const changeSelectedType = (type: FieldType) => {
    for (const field of getSelectedFields()) {
      if (field.type !== type) {
        editorFields.updateFieldByFormId(field.formId, {
          type,
          fieldMeta: structuredClone(FIELD_META_DEFAULT_VALUES[type]),
          id: undefined,
        });
      }
    }
  };

  return {
    localPageFields,
    renderAll,
    selectInBox,
    pendingCreation: pending.pendingCreation,
    createFromPending,
    clearPending: pending.clearPending,
    deleteSelected,
    duplicateSelected,
    duplicateSelectedOnAllPages,
    changeSelectedRecipient,
    changeSelectedType,
  };
};
