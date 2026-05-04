import { useEffect, useMemo, useRef, useState } from 'react';

import { useLingui } from '@lingui/react/macro';
import { DocumentStatus, type FieldType } from '@prisma/client';
import Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { Transformer } from 'konva/lib/shapes/Transformer';
import { CopyPlusIcon, SquareStackIcon, TrashIcon, UserCircleIcon } from 'lucide-react';

import type { TLocalField } from '@documenso/lib/client-only/hooks/use-editor-fields';
import type { TLocalRedaction } from '@documenso/lib/client-only/hooks/use-editor-redactions';
import { usePageRenderer } from '@documenso/lib/client-only/hooks/use-page-renderer';
import { useCurrentEnvelopeEditor } from '@documenso/lib/client-only/providers/envelope-editor-provider';
import {
  type PageRenderData,
  useCurrentEnvelopeRender,
} from '@documenso/lib/client-only/providers/envelope-render-provider';
import { FIELD_META_DEFAULT_VALUES } from '@documenso/lib/types/field-meta';
import {
  MIN_FIELD_HEIGHT_PX,
  MIN_FIELD_WIDTH_PX,
  convertPixelToPercentage,
} from '@documenso/lib/universal/field-renderer/field-renderer';
import { renderField } from '@documenso/lib/universal/field-renderer/render-field';
import { getClientSideFieldTranslations } from '@documenso/lib/utils/fields';
import { canRecipientFieldsBeModified } from '@documenso/lib/utils/recipients';
import { CommandDialog } from '@documenso/ui/primitives/command';

import { fieldButtonList } from './envelope-editor-fields-drag-drop';
import { EnvelopeRecipientSelectorCommand } from './envelope-recipient-selector';

export const EnvelopeEditorFieldsPageRenderer = ({ pageData }: { pageData: PageRenderData }) => {
  const { t, i18n } = useLingui();
  const { envelope, editorFields, editorRedactions, getRecipientColorKey } =
    useCurrentEnvelopeEditor();
  const { currentEnvelopeItem, setRenderError } = useCurrentEnvelopeRender();

  const interactiveTransformer = useRef<Transformer | null>(null);
  const redactionTransformer = useRef<Transformer | null>(null);

  const [selectedKonvaFieldGroups, setSelectedKonvaFieldGroups] = useState<Konva.Group[]>([]);
  const [selectedKonvaRedactionGroups, setSelectedKonvaRedactionGroups] = useState<Konva.Group[]>(
    [],
  );

  const [isFieldChanging, setIsFieldChanging] = useState(false);
  const [isRedactionChanging, setIsRedactionChanging] = useState(false);
  const [pendingFieldCreation, setPendingFieldCreation] = useState<Konva.Rect | null>(null);

  const { stage, pageLayer, konvaContainer, scaledViewport, unscaledViewport } = usePageRenderer(
    ({ stage, pageLayer }) => createPageCanvas(stage, pageLayer),
    pageData,
  );

  const { scale, pageNumber } = pageData;

  const localPageFields = useMemo(
    () =>
      editorFields.localFields.filter(
        (field) => field.page === pageNumber && field.envelopeItemId === currentEnvelopeItem?.id,
      ),
    [editorFields.localFields, pageNumber, currentEnvelopeItem?.id],
  );

  const localPageRedactions = useMemo(
    () =>
      editorRedactions.localRedactions.filter(
        (r) => r.page === pageNumber && r.envelopeItemId === currentEnvelopeItem?.id,
      ),
    [editorRedactions.localRedactions, pageNumber, currentEnvelopeItem?.id],
  );

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
    if (isDragEvent && interactiveTransformer.current?.nodes().length === 0) {
      setSelectedFields([fieldGroup]);
    }

    pageLayer.current?.batchDraw();
  };

  const unsafeRenderFieldOnLayer = (field: TLocalField) => {
    if (!pageLayer.current) {
      return;
    }

    const recipient = envelope.recipients.find((r) => r.id === field.recipientId);
    const isFieldEditable =
      recipient !== undefined && canRecipientFieldsBeModified(recipient, envelope.fields);

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
      color: getRecipientColorKey(field.recipientId),
      editable: isFieldEditable,
      mode: 'edit',
    });

    if (!isFieldEditable) {
      return;
    }

    fieldGroup.off('click');
    fieldGroup.off('transformend');
    fieldGroup.off('dragend');

    // Set up field selection.
    fieldGroup.on('click', () => {
      removePendingField();
      setSelectedRedactions([]);
      setSelectedFields([fieldGroup]);
      pageLayer.current?.batchDraw();
    });

    fieldGroup.on('transformend', handleResizeOrMove);
    fieldGroup.on('dragend', handleResizeOrMove);
  };

  const renderFieldOnLayer = (field: TLocalField) => {
    try {
      unsafeRenderFieldOnLayer(field);
    } catch (err) {
      console.error(err);
      setRenderError(true);
    }
  };

  const handleRedactionResizeOrMove = (event: KonvaEventObject<Event>) => {
    const isDragEvent = event.type === 'dragend';

    const group = event.target as Konva.Group;
    const formId = group.id();

    // Note: getClientRect returns POST-transform (scaled) pixels.
    const {
      width: scaledPixelWidth,
      height: scaledPixelHeight,
      x: scaledX,
      y: scaledY,
    } = group.getClientRect({
      skipStroke: true,
      skipShadow: true,
    });

    const pageWidth = scaledViewport.width;
    const pageHeight = scaledViewport.height;

    const positionPercentX = (scaledX / pageWidth) * 100;
    const positionPercentY = (scaledY / pageHeight) * 100;

    const updates: Partial<TLocalRedaction> = {
      positionX: positionPercentX,
      positionY: positionPercentY,
    };

    // Only update width/height on resize (not on drag). Same rationale as
    // handleResizeOrMove — percentage/pixel round-tripping would otherwise
    // nudge the size on every drag.
    if (!isDragEvent) {
      updates.width = (scaledPixelWidth / pageWidth) * 100;
      updates.height = (scaledPixelHeight / pageHeight) * 100;
    }

    editorRedactions.updateRedactionByFormId(formId, updates);

    // Select on drag-end if nothing was explicitly selected.
    if (isDragEvent && redactionTransformer.current?.nodes().length === 0) {
      setSelectedRedactions([group]);
    }

    pageLayer.current?.batchDraw();
  };

  const renderRedactionOnLayer = (redaction: TLocalRedaction) => {
    if (!pageLayer.current) {
      return;
    }

    // Position/size are stored as percentages of the PDF page. The Konva
    // stage itself has a scale transform applied (see usePageRenderer), so
    // we must place the group using the UNSCALED viewport — otherwise the
    // placement gets double-scaled and drifts away from the click point.
    const pageWidth = unscaledViewport.width;
    const pageHeight = unscaledViewport.height;

    const x = (redaction.positionX / 100) * pageWidth;
    const y = (redaction.positionY / 100) * pageHeight;
    const width = (redaction.width / 100) * pageWidth;
    const height = (redaction.height / 100) * pageHeight;

    const isEditable = envelope.status === DocumentStatus.DRAFT;

    const maxXPosition = pageWidth - width;
    const maxYPosition = pageHeight - height;

    const group = new Konva.Group({
      id: redaction.formId,
      name: 'redaction-group',
      x,
      y,
      draggable: isEditable,
      listening: true,
      dragBoundFunc: (pos) => {
        // Konva calls dragBoundFunc with stage (post-scale) pixel coords.
        const maxX = maxXPosition * scale;
        const maxY = maxYPosition * scale;
        const newX = Math.max(0, Math.min(maxX, pos.x));
        const newY = Math.max(0, Math.min(maxY, pos.y));
        return { x: newX, y: newY };
      },
    });

    const rect = new Konva.Rect({
      x: 0,
      y: 0,
      width,
      height,
      fill: '#000000',
      opacity: 1,
      stroke: 'transparent',
      strokeWidth: 2,
      strokeScaleEnabled: false,
    });

    const label = new Konva.Text({
      x: 0,
      y: 0,
      width,
      height,
      text: 'REDACTED',
      fontSize: Math.max(8, Math.min(12, height * 0.5)),
      fontFamily: 'sans-serif',
      fontStyle: 'bold',
      fill: '#ffffff',
      align: 'center',
      verticalAlign: 'middle',
      listening: false,
    });

    group.add(rect);
    group.add(label);

    // Keep the label sized to the rect while resizing (so the 'REDACTED'
    // text doesn't stretch mid-transform) and bake the scale into the rect
    // on transform-end so subsequent drags start from a clean scale of 1.
    group.on('transform', () => {
      const sx = group.scaleX();
      const sy = group.scaleY();

      label.scaleX(1 / sx);
      label.scaleY(1 / sy);

      const rectWidth = rect.width() * sx;
      const rectHeight = rect.height() * sy;
      label.width(rectWidth);
      label.height(rectHeight);
      label.fontSize(Math.max(8, Math.min(12, rectHeight * 0.5)));
    });

    group.on('transformend', () => {
      const sx = group.scaleX();
      const sy = group.scaleY();

      const newWidth = rect.width() * sx;
      const newHeight = rect.height() * sy;

      rect.width(newWidth);
      rect.height(newHeight);
      label.width(newWidth);
      label.height(newHeight);
      label.scaleX(1);
      label.scaleY(1);
      label.fontSize(Math.max(8, Math.min(12, newHeight * 0.5)));

      group.scaleX(1);
      group.scaleY(1);
    });

    if (isEditable) {
      group.on('mouseenter', () => {
        rect.stroke('#ef4444');
        pageLayer.current?.batchDraw();
        const container = pageLayer.current?.getStage()?.container();
        if (container) {
          container.style.cursor = 'pointer';
        }
      });

      group.on('mouseleave', () => {
        rect.stroke('transparent');
        pageLayer.current?.batchDraw();
        const container = pageLayer.current?.getStage()?.container();
        if (container) {
          container.style.cursor = 'default';
        }
      });

      group.on('click', () => {
        removePendingField();
        setSelectedFields([]);
        setSelectedRedactions([group]);
        pageLayer.current?.batchDraw();
      });

      group.on('transformend', handleRedactionResizeOrMove);
      group.on('dragend', handleRedactionResizeOrMove);
    }

    pageLayer.current.add(group);
  };

  /**
   * Initialize the Konva page canvas and all fields and interactions.
   */
  const createPageCanvas = (currentStage: Konva.Stage, currentPageLayer: Konva.Layer) => {
    // Initialize snap guides layer
    // snapGuideLayer.current = initializeSnapGuides(stage.current);

    // Add transformer for resizing and rotating.
    interactiveTransformer.current = createInteractiveTransformer(currentStage, currentPageLayer);
    redactionTransformer.current = createRedactionTransformer(currentPageLayer);

    // Render the fields.
    for (const field of localPageFields) {
      renderFieldOnLayer(field);
    }

    // Render the redactions.
    for (const redaction of localPageRedactions) {
      renderRedactionOnLayer(redaction);
    }

    // Handle stage click to deselect.
    currentStage.on('mousedown', (e) => {
      removePendingField();

      if (e.target === stage.current) {
        setSelectedFields([]);
        setSelectedRedactions([]);
        currentPageLayer.batchDraw();
      }
    });

    // When an item is dragged, select it automatically.
    const onDragStartOrEnd = (e: KonvaEventObject<Event>) => {
      removePendingField();

      if (e.target.hasName('field-group')) {
        setIsFieldChanging(e.type === 'dragstart');

        const itemAlreadySelected = (interactiveTransformer.current?.nodes() || []).includes(
          e.target,
        );

        // Do nothing and allow the transformer to handle it.
        // Required so when multiple items are selected, this won't deselect them.
        if (itemAlreadySelected) {
          return;
        }

        setSelectedFields([e.target]);
        return;
      }

      if (e.target.hasName('redaction-group')) {
        setIsRedactionChanging(e.type === 'dragstart');

        const itemAlreadySelected = (redactionTransformer.current?.nodes() || []).includes(
          e.target,
        );

        if (itemAlreadySelected) {
          return;
        }

        setSelectedRedactions([e.target]);
      }
    };

    currentStage.on('dragstart', onDragStartOrEnd);
    currentStage.on('dragend', onDragStartOrEnd);
    currentStage.on('transformstart', (e) => {
      if (e.target.hasName('redaction-group')) {
        setIsRedactionChanging(true);
      } else {
        setIsFieldChanging(true);
      }
    });
    currentStage.on('transformend', (e) => {
      if (e.target.hasName('redaction-group')) {
        setIsRedactionChanging(false);
      } else {
        setIsFieldChanging(false);
      }
    });

    currentPageLayer.batchDraw();
  };

  /**
   * A dedicated transformer for redactions. Separate from the field
   * transformer so field and redaction selections never mix and so each
   * transformer can have its own minimum-size and visual styling.
   */
  const createRedactionTransformer = (currentPageLayer: Konva.Layer) => {
    const transformer = new Konva.Transformer({
      rotateEnabled: false,
      keepRatio: false,
      shouldOverdrawWholeArea: true,
      ignoreStroke: true,
      flipEnabled: false,
      borderStroke: '#ef4444',
      anchorStroke: '#ef4444',
      anchorFill: '#ffffff',
      boundBoxFunc: (oldBox, newBox) => {
        if (newBox.width < 10 || newBox.height < 8) {
          return oldBox;
        }

        return newBox;
      },
    });

    currentPageLayer.add(transformer);

    return transformer;
  };

  /**
   * Creates an interactive transformer for the fields.
   *
   * Allows:
   * - Resizing
   * - Moving
   * - Selecting multiple fields
   * - Selecting empty area to create fields
   */
  const createInteractiveTransformer = (
    currentStage: Konva.Stage,
    currentPageLayer: Konva.Layer,
  ) => {
    const transformer = new Konva.Transformer({
      rotateEnabled: false,
      keepRatio: false,
      shouldOverdrawWholeArea: true,
      ignoreStroke: true,
      flipEnabled: false,
      boundBoxFunc: (oldBox, newBox) => {
        // Enforce minimum size
        if (newBox.width < 30 || newBox.height < 20) {
          return oldBox;
        }

        return newBox;
      },
    });

    currentPageLayer.add(transformer);

    // Add selection rectangle.
    const selectionRectangle = new Konva.Rect({
      fill: 'rgba(24, 160, 251, 0.3)',
      visible: false,
    });
    currentPageLayer.add(selectionRectangle);

    let x1: number;
    let y1: number;
    let x2: number;
    let y2: number;

    currentStage.on('mousedown touchstart', (e) => {
      // do nothing if we mousedown on any shape
      if (e.target !== currentStage) {
        return;
      }

      const pointerPosition = currentStage.getPointerPosition();

      if (!pointerPosition) {
        return;
      }

      x1 = pointerPosition.x / scale;
      y1 = pointerPosition.y / scale;
      x2 = pointerPosition.x / scale;
      y2 = pointerPosition.y / scale;

      selectionRectangle.setAttrs({
        x: x1,
        y: y1,
        width: 0,
        height: 0,
        visible: true,
      });
    });

    currentStage.on('mousemove touchmove', () => {
      // do nothing if we didn't start selection
      if (!selectionRectangle.visible()) {
        return;
      }

      selectionRectangle.moveToTop();

      const pointerPosition = currentStage.getPointerPosition();

      if (!pointerPosition) {
        return;
      }

      x2 = pointerPosition.x / scale;
      y2 = pointerPosition.y / scale;

      selectionRectangle.setAttrs({
        x: Math.min(x1, x2),
        y: Math.min(y1, y2),
        width: Math.abs(x2 - x1),
        height: Math.abs(y2 - y1),
      });
    });

    currentStage.on('mouseup touchend', () => {
      // do nothing if we didn't start selection
      if (!selectionRectangle.visible()) {
        return;
      }

      // Update visibility in timeout, so we can check it in click event
      setTimeout(() => {
        selectionRectangle.visible(false);
      });

      const stageFieldGroups = currentStage.find('.field-group') || [];
      const box = selectionRectangle.getClientRect();
      const selectedFieldGroups = stageFieldGroups.filter(
        (shape) => Konva.Util.haveIntersection(box, shape.getClientRect()) && shape.draggable(),
      );
      setSelectedFields(selectedFieldGroups);

      const unscaledBoxWidth = box.width / scale;
      const unscaledBoxHeight = box.height / scale;

      // Create a field if no items are selected or the size is too small.
      if (
        selectedFieldGroups.length === 0 &&
        unscaledBoxWidth > MIN_FIELD_WIDTH_PX &&
        unscaledBoxHeight > MIN_FIELD_HEIGHT_PX &&
        editorFields.selectedRecipient &&
        canRecipientFieldsBeModified(editorFields.selectedRecipient, envelope.fields)
      ) {
        const pendingFieldCreation = new Konva.Rect({
          name: 'pending-field-creation',
          x: box.x / scale,
          y: box.y / scale,
          width: unscaledBoxWidth,
          height: unscaledBoxHeight,
          fill: 'rgba(24, 160, 251, 0.3)',
        });

        currentPageLayer.add(pendingFieldCreation);
        setPendingFieldCreation(pendingFieldCreation);
      }
    });

    // Clicks should select/deselect shapes
    currentStage.on('click tap', function (e) {
      // if we are selecting with rect, do nothing
      if (
        selectionRectangle.visible() &&
        selectionRectangle.width() > 0 &&
        selectionRectangle.height() > 0
      ) {
        return;
      }

      // If empty area clicked, remove all selections
      if (e.target === stage.current) {
        setSelectedFields([]);
        setSelectedRedactions([]);
        return;
      }

      // Do nothing if field not clicked, or if field is not editable
      if (!e.target.hasName('field-group') || e.target.draggable() === false) {
        return;
      }

      // do we pressed shift or ctrl?
      const metaPressed = e.evt.shiftKey || e.evt.ctrlKey || e.evt.metaKey;
      const isSelected = transformer.nodes().indexOf(e.target) >= 0;

      if (!metaPressed && !isSelected) {
        // if no key pressed and the node is not selected
        // select just one
        setSelectedFields([e.target]);
      } else if (metaPressed && isSelected) {
        // if we pressed keys and node was selected
        // we need to remove it from selection:
        const nodes = transformer.nodes().slice(); // use slice to have new copy of array
        // remove node from array
        nodes.splice(nodes.indexOf(e.target), 1);
        setSelectedFields(nodes);
      } else if (metaPressed && !isSelected) {
        // add the node into selection
        const nodes = transformer.nodes().concat([e.target]);
        setSelectedFields(nodes);
      }
    });

    return transformer;
  };

  /**
   * Render fields when they are added or removed from the localFields.
   */
  useEffect(() => {
    if (!pageLayer.current || !stage.current) {
      return;
    }

    // If doesn't exist in localFields, destroy it since it's been deleted.
    pageLayer.current.find('Group').forEach((group) => {
      if (
        group.name() === 'field-group' &&
        !localPageFields.some((field) => field.formId === group.id())
      ) {
        group.destroy();
      }
    });

    // If it exists, rerender.
    localPageFields.forEach((field) => {
      renderFieldOnLayer(field);
    });

    // Reconcile selection state with live field nodes after flush/sync updates.
    const liveSelectedFieldGroups = selectedKonvaFieldGroups.filter((fieldGroup) => {
      if (!fieldGroup.getStage() || !fieldGroup.getParent()) {
        return false;
      }

      return localPageFields.some((field) => field.formId === fieldGroup.id());
    });

    if (liveSelectedFieldGroups.length !== selectedKonvaFieldGroups.length) {
      setSelectedFields(liveSelectedFieldGroups);
    }

    // Rerender the transformer
    interactiveTransformer.current?.forceUpdate();

    pageLayer.current.batchDraw();
  }, [localPageFields, selectedKonvaFieldGroups]);

  /**
   * Render redactions when they are added or removed from localRedactions.
   */
  useEffect(() => {
    if (!pageLayer.current || !stage.current) {
      return;
    }

    // Destroy redaction groups that no longer exist in localPageRedactions.
    pageLayer.current.find('Group').forEach((group) => {
      if (
        group.name() === 'redaction-group' &&
        !localPageRedactions.some((r) => r.formId === group.id())
      ) {
        group.destroy();
      }
    });

    // Render new redactions, or sync existing group geometry with the latest
    // local state so external changes (e.g., sync from the server) are
    // reflected without leaving the handlers we attached dangling.
    localPageRedactions.forEach((redaction) => {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const existing = pageLayer.current
        ?.find('Group')
        .find((group) => group.name() === 'redaction-group' && group.id() === redaction.formId) as
        | Konva.Group
        | undefined;

      if (!existing) {
        renderRedactionOnLayer(redaction);
        return;
      }

      const pageWidth = unscaledViewport.width;
      const pageHeight = unscaledViewport.height;

      const x = (redaction.positionX / 100) * pageWidth;
      const y = (redaction.positionY / 100) * pageHeight;
      const width = (redaction.width / 100) * pageWidth;
      const height = (redaction.height / 100) * pageHeight;

      existing.position({ x, y });
      existing.scaleX(1);
      existing.scaleY(1);

      const rect = existing.findOne<Konva.Rect>('Rect');
      const label = existing.findOne<Konva.Text>('Text');

      if (rect) {
        rect.width(width);
        rect.height(height);
      }

      if (label) {
        label.width(width);
        label.height(height);
        label.scaleX(1);
        label.scaleY(1);
        label.fontSize(Math.max(8, Math.min(12, height * 0.5)));
      }
    });

    // Reconcile redaction selection with live nodes.
    const liveSelectedRedactionGroups = selectedKonvaRedactionGroups.filter((group) => {
      if (!group.getStage() || !group.getParent()) {
        return false;
      }

      return localPageRedactions.some((r) => r.formId === group.id());
    });

    if (liveSelectedRedactionGroups.length !== selectedKonvaRedactionGroups.length) {
      setSelectedRedactions(liveSelectedRedactionGroups);
    }

    redactionTransformer.current?.forceUpdate();

    pageLayer.current.batchDraw();
  }, [localPageRedactions, selectedKonvaRedactionGroups]);

  const setSelectedFields = (nodes: Konva.Node[]) => {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const fieldGroups = nodes.filter(
      (node) =>
        node.hasName('field-group') && Boolean(node.getStage()) && Boolean(node.getParent()),
    ) as Konva.Group[];

    interactiveTransformer.current?.nodes(fieldGroups);
    setSelectedKonvaFieldGroups(fieldGroups);

    if (fieldGroups.length === 0 || fieldGroups.length > 1) {
      editorFields.setSelectedField(null);
    }

    // Handle single field selection.
    if (fieldGroups.length === 1) {
      const fieldGroup = fieldGroups[0];

      editorFields.setSelectedField(fieldGroup.id());
      fieldGroup.moveToTop();
    }
  };

  const deletedSelectedFields = () => {
    const fieldFormids = selectedKonvaFieldGroups
      .map((field) => field.id())
      .filter((field) => field !== undefined);

    editorFields.removeFieldsByFormId(fieldFormids);

    setSelectedFields([]);
  };

  const setSelectedRedactions = (nodes: Konva.Node[]) => {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const redactionGroups = nodes.filter(
      (node) =>
        node.hasName('redaction-group') && Boolean(node.getStage()) && Boolean(node.getParent()),
    ) as Konva.Group[];

    redactionTransformer.current?.nodes(redactionGroups);
    setSelectedKonvaRedactionGroups(redactionGroups);

    if (redactionGroups.length === 1) {
      redactionGroups[0].moveToTop();
      // Keep the transformer above the group we just moved to top so its
      // handles stay interactive.
      redactionTransformer.current?.moveToTop();
    }
  };

  const deleteSelectedRedactions = () => {
    const formIds = selectedKonvaRedactionGroups
      .map((group) => group.id())
      .filter((id) => id !== undefined);

    editorRedactions.removeRedactionsByFormId(formIds);

    setSelectedRedactions([]);
  };

  const changeSelectedFieldsRecipients = (recipientId: number) => {
    const fields = selectedKonvaFieldGroups
      .map((field) => editorFields.getFieldByFormId(field.id()))
      .filter((field) => field !== undefined);

    for (const field of fields) {
      if (field.recipientId !== recipientId) {
        editorFields.updateFieldByFormId(field.formId, { recipientId, id: undefined });
      }
    }
  };

  const duplicatedSelectedFields = () => {
    const fields = selectedKonvaFieldGroups
      .map((field) => editorFields.getFieldByFormId(field.id()))
      .filter((field) => field !== undefined);

    for (const field of fields) {
      editorFields.duplicateField(field);
    }
  };

  const duplicatedSelectedFieldsOnAllPages = () => {
    const fields = selectedKonvaFieldGroups
      .map((field) => editorFields.getFieldByFormId(field.id()))
      .filter((field) => field !== undefined);

    for (const field of fields) {
      editorFields.duplicateFieldToAllPages(field);
    }

    setSelectedFields([]);
  };

  /**
   * Create a field from a pending field.
   */
  const createFieldFromPendingTemplate = (pendingFieldCreation: Konva.Rect, type: FieldType) => {
    const pixelWidth = pendingFieldCreation.width();
    const pixelHeight = pendingFieldCreation.height();
    const pixelX = pendingFieldCreation.x();
    const pixelY = pendingFieldCreation.y();

    removePendingField();

    if (!currentEnvelopeItem || !editorFields.selectedRecipient) {
      return;
    }

    const { fieldX, fieldY, fieldWidth, fieldHeight } = convertPixelToPercentage({
      width: pixelWidth,
      height: pixelHeight,
      positionX: pixelX,
      positionY: pixelY,
      pageWidth: unscaledViewport.width,
      pageHeight: unscaledViewport.height,
    });

    editorFields.addField({
      envelopeItemId: currentEnvelopeItem.id,
      page: pageNumber,
      type,
      positionX: fieldX,
      positionY: fieldY,
      width: fieldWidth,
      height: fieldHeight,
      recipientId: editorFields.selectedRecipient.id,
      fieldMeta: structuredClone(FIELD_META_DEFAULT_VALUES[type]),
    });
  };

  /**
   * Remove any pending fields or rectangle on the canvas.
   */
  const removePendingField = () => {
    setPendingFieldCreation(null);

    const pendingFieldCreation = pageLayer.current?.find('.pending-field-creation') || [];

    for (const field of pendingFieldCreation) {
      field.destroy();
    }
  };

  if (!currentEnvelopeItem) {
    return null;
  }

  return (
    <>
      {selectedKonvaFieldGroups.length > 0 &&
        interactiveTransformer.current &&
        !isFieldChanging && (
          <FieldActionButtons
            handleDuplicateSelectedFields={duplicatedSelectedFields}
            handleDuplicateSelectedFieldsOnAllPages={duplicatedSelectedFieldsOnAllPages}
            handleDeleteSelectedFields={deletedSelectedFields}
            handleChangeRecipient={changeSelectedFieldsRecipients}
            selectedFieldFormId={selectedKonvaFieldGroups.map((field) => field.id())}
            style={{
              position: 'absolute',
              top:
                interactiveTransformer.current.y() +
                interactiveTransformer.current.getClientRect().height +
                5 +
                'px',
              left:
                interactiveTransformer.current.x() +
                interactiveTransformer.current.getClientRect().width / 2 +
                'px',
              transform: 'translateX(-50%)',
              gap: '8px',
              pointerEvents: 'auto',
              zIndex: 50,
            }}
          />
        )}

      {selectedKonvaRedactionGroups.length > 0 &&
        redactionTransformer.current &&
        !isRedactionChanging && (
          <RedactionActionButtons
            handleDeleteSelectedRedactions={deleteSelectedRedactions}
            style={{
              position: 'absolute',
              top:
                redactionTransformer.current.y() +
                redactionTransformer.current.getClientRect().height +
                5 +
                'px',
              left:
                redactionTransformer.current.x() +
                redactionTransformer.current.getClientRect().width / 2 +
                'px',
              transform: 'translateX(-50%)',
              gap: '8px',
              pointerEvents: 'auto',
              zIndex: 50,
            }}
          />
        )}

      {pendingFieldCreation && (
        <div
          style={{
            position: 'absolute',
            top:
              pendingFieldCreation.y() * scale +
              pendingFieldCreation.getClientRect().height +
              5 +
              'px',
            left:
              pendingFieldCreation.x() * scale +
              pendingFieldCreation.getClientRect().width / 2 +
              'px',
            transform: 'translateX(-50%)',
            zIndex: 50,
          }}
          // Don't use darkmode for this component, it should look the same for both light/dark modes.
          className="grid w-max grid-cols-5 gap-x-1 gap-y-0.5 rounded-md border border-gray-300 bg-white p-1 text-gray-500 shadow-sm"
        >
          {fieldButtonList.map((field) => (
            <button
              key={field.type}
              onClick={() => createFieldFromPendingTemplate(pendingFieldCreation, field.type)}
              className="col-span-1 w-full flex-shrink-0 rounded-sm px-2 py-1 text-xs hover:bg-gray-100 hover:text-gray-600"
            >
              {t(field.name)}
            </button>
          ))}
        </div>
      )}

      {/* The element Konva will inject it's canvas into. */}
      <div className="konva-container absolute inset-0 z-10 w-full" ref={konvaContainer}></div>
    </>
  );
};

type FieldActionButtonsProps = React.HTMLAttributes<HTMLDivElement> & {
  handleDuplicateSelectedFields: () => void;
  handleDuplicateSelectedFieldsOnAllPages: () => void;
  handleDeleteSelectedFields: () => void;
  handleChangeRecipient: (recipientId: number) => void;
  selectedFieldFormId: string[];
};

const FieldActionButtons = ({
  handleDuplicateSelectedFields,
  handleDuplicateSelectedFieldsOnAllPages,
  handleDeleteSelectedFields,
  handleChangeRecipient,
  selectedFieldFormId,
  ...props
}: FieldActionButtonsProps) => {
  const { t } = useLingui();

  const [showRecipientSelector, setShowRecipientSelector] = useState(false);

  const { editorFields, envelope } = useCurrentEnvelopeEditor();

  /**
   * Decide the preselected recipient in the command input.
   *
   * If all fields belong to the same recipient then use that recipient as the default.
   *
   * Otherwise show the placeholder.
   */
  const preselectedRecipient = useMemo(() => {
    if (selectedFieldFormId.length === 0) {
      return null;
    }

    const fields = editorFields.localFields.filter((field) =>
      selectedFieldFormId.includes(field.formId),
    );

    if (fields.length === 0) {
      return null;
    }

    const recipient = envelope.recipients.find(
      (recipient) => recipient.id === fields[0].recipientId,
    );

    if (!recipient) {
      return null;
    }

    const isRecipientsSame = fields.every((field) => field.recipientId === recipient.id);

    if (isRecipientsSame) {
      return recipient;
    }

    return null;
  }, [editorFields.localFields, envelope.recipients, selectedFieldFormId]);

  return (
    <div className="flex flex-col items-center" {...props}>
      <div className="group flex w-fit items-center justify-evenly gap-x-1 rounded-md border bg-gray-900 p-0.5">
        <button
          title={t`Change Recipient`}
          className="rounded-sm p-1.5 text-gray-400 transition-colors hover:bg-white/10 hover:text-gray-100"
          onClick={() => setShowRecipientSelector(true)}
          onTouchEnd={() => setShowRecipientSelector(true)}
        >
          <UserCircleIcon className="h-3 w-3" />
        </button>

        <button
          title={t`Duplicate`}
          className="rounded-sm p-1.5 text-gray-400 transition-colors hover:bg-white/10 hover:text-gray-100"
          onClick={handleDuplicateSelectedFields}
          onTouchEnd={handleDuplicateSelectedFields}
        >
          <CopyPlusIcon className="h-3 w-3" />
        </button>

        <button
          title={t`Duplicate on all pages`}
          className="rounded-sm p-1.5 text-gray-400 transition-colors hover:bg-white/10 hover:text-gray-100"
          onClick={handleDuplicateSelectedFieldsOnAllPages}
          onTouchEnd={handleDuplicateSelectedFieldsOnAllPages}
        >
          <SquareStackIcon className="h-3 w-3" />
        </button>

        <button
          title={t`Remove`}
          className="rounded-sm p-1.5 text-gray-400 transition-colors hover:bg-white/10 hover:text-gray-100"
          onClick={handleDeleteSelectedFields}
          onTouchEnd={handleDeleteSelectedFields}
        >
          <TrashIcon className="h-3 w-3" />
        </button>
      </div>

      <CommandDialog
        position="start"
        open={showRecipientSelector}
        onOpenChange={setShowRecipientSelector}
      >
        <EnvelopeRecipientSelectorCommand
          placeholder={t`Select a recipient`}
          selectedRecipient={preselectedRecipient}
          onSelectedRecipientChange={(recipient) => {
            editorFields.setSelectedRecipient(recipient.id);
            handleChangeRecipient(recipient.id);
            setShowRecipientSelector(false);
          }}
          recipients={envelope.recipients}
          fields={envelope.fields}
        />
      </CommandDialog>
    </div>
  );
};

type RedactionActionButtonsProps = React.HTMLAttributes<HTMLDivElement> & {
  handleDeleteSelectedRedactions: () => void;
};

const RedactionActionButtons = ({
  handleDeleteSelectedRedactions,
  ...props
}: RedactionActionButtonsProps) => {
  const { t } = useLingui();

  return (
    <div className="flex flex-col items-center" {...props}>
      <div className="group flex w-fit items-center justify-evenly gap-x-1 rounded-md border bg-gray-900 p-0.5">
        <button
          title={t`Remove`}
          className="rounded-sm p-1.5 text-gray-400 transition-colors hover:bg-white/10 hover:text-gray-100"
          onClick={handleDeleteSelectedRedactions}
          onTouchEnd={handleDeleteSelectedRedactions}
        >
          <TrashIcon className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
};
