import { useEffect, useMemo, useRef, useState } from 'react';

import { useLingui } from '@lingui/react/macro';
import type { FieldType } from '@prisma/client';
import Konva from 'konva';
import type { Layer } from 'konva/lib/Layer';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { Transformer } from 'konva/lib/shapes/Transformer';
import { CopyPlusIcon, SquareStackIcon, TrashIcon } from 'lucide-react';
import type { RenderParameters } from 'pdfjs-dist/types/src/display/api';
import { usePageContext } from 'react-pdf';

import { getBoundingClientRect } from '@documenso/lib/client-only/get-bounding-client-rect';
import type { TLocalField } from '@documenso/lib/client-only/hooks/use-editor-fields';
import { useCurrentEnvelopeEditor } from '@documenso/lib/client-only/providers/envelope-editor-provider';
import { useCurrentEnvelopeRender } from '@documenso/lib/client-only/providers/envelope-render-provider';
import { FIELD_META_DEFAULT_VALUES } from '@documenso/lib/types/field-meta';
import {
  MIN_FIELD_HEIGHT_PX,
  MIN_FIELD_WIDTH_PX,
  convertPixelToPercentage,
} from '@documenso/lib/universal/field-renderer/field-renderer';
import { renderField } from '@documenso/lib/universal/field-renderer/render-field';
import { canRecipientFieldsBeModified } from '@documenso/lib/utils/recipients';

import { fieldButtonList } from './envelope-editor-fields-drag-drop';

export default function EnvelopeEditorFieldsPageRenderer() {
  const pageContext = usePageContext();

  if (!pageContext) {
    throw new Error('Unable to find Page context.');
  }

  const { _className, page, rotate, scale } = pageContext;

  if (!page) {
    throw new Error('Attempted to render page canvas, but no page was specified.');
  }

  const { t } = useLingui();
  const { envelope, editorFields, getRecipientColorKey } = useCurrentEnvelopeEditor();
  const { currentEnvelopeItem } = useCurrentEnvelopeRender();

  const canvasElement = useRef<HTMLCanvasElement>(null);
  const konvaContainer = useRef<HTMLDivElement>(null);

  const stage = useRef<Konva.Stage | null>(null);
  const pageLayer = useRef<Layer | null>(null);
  const interactiveTransformer = useRef<Transformer | null>(null);

  const [selectedKonvaFieldGroups, setSelectedKonvaFieldGroups] = useState<Konva.Group[]>([]);

  const [isFieldChanging, setIsFieldChanging] = useState(false);
  const [pendingFieldCreation, setPendingFieldCreation] = useState<Konva.Rect | null>(null);

  const viewport = useMemo(
    () => page.getViewport({ scale, rotation: rotate }),
    [page, rotate, scale],
  );

  const localPageFields = useMemo(
    () =>
      editorFields.localFields.filter(
        (field) =>
          field.page === pageContext.pageNumber && field.envelopeItemId === currentEnvelopeItem?.id,
      ),
    [editorFields.localFields, pageContext.pageNumber],
  );

  // Custom renderer from Konva examples.
  useEffect(
    function drawPageOnCanvas() {
      if (!page) {
        return;
      }

      const { current: canvas } = canvasElement;
      const { current: container } = konvaContainer;

      if (!canvas || !container) {
        return;
      }

      const renderContext: RenderParameters = {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        canvasContext: canvas.getContext('2d', { alpha: false }) as CanvasRenderingContext2D,
        viewport,
      };

      const cancellable = page.render(renderContext);
      const runningTask = cancellable;

      cancellable.promise.catch(() => {
        // Intentionally empty
      });

      void cancellable.promise.then(() => {
        createPageCanvas(container);
      });

      return () => {
        runningTask.cancel();
      };
    },
    [page, viewport],
  );

  const handleResizeOrMove = (event: KonvaEventObject<Event>) => {
    console.log('Field resized or moved');

    const { current: container } = canvasElement;

    if (!container) {
      return;
    }

    const isDragEvent = event.type === 'dragend';

    const fieldGroup = event.target as Konva.Group;
    const fieldFormId = fieldGroup.id();

    const {
      width: fieldPixelWidth,
      height: fieldPixelHeight,
      x: fieldX,
      y: fieldY,
    } = fieldGroup.getClientRect({
      skipStroke: true,
      skipShadow: true,
    });

    const { height: pageHeight, width: pageWidth } = getBoundingClientRect(container);

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

    // Todo: envelopes Use id
    editorFields.updateFieldByFormId(fieldFormId, fieldUpdates);

    // Select the field if it is not already selected.
    if (isDragEvent && interactiveTransformer.current?.nodes().length === 0) {
      setSelectedFields([fieldGroup]);
    }

    pageLayer.current?.batchDraw();
  };

  const renderFieldOnLayer = (field: TLocalField) => {
    if (!pageLayer.current || !interactiveTransformer.current) {
      console.error('Layer not loaded yet');
      return;
    }

    const recipient = envelope.recipients.find((r) => r.id === field.recipientId);
    const isFieldEditable =
      recipient !== undefined && canRecipientFieldsBeModified(recipient, envelope.fields);

    const { fieldGroup, isFirstRender } = renderField({
      pageLayer: pageLayer.current,
      field: {
        renderId: field.formId,
        ...field,
        customText: '',
        inserted: false,
        fieldMeta: field.fieldMeta,
      },
      pageWidth: viewport.width,
      pageHeight: viewport.height,
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
      setSelectedFields([fieldGroup]);
      pageLayer.current?.batchDraw();
    });

    fieldGroup.on('transformend', handleResizeOrMove);
    fieldGroup.on('dragend', handleResizeOrMove);
  };

  /**
   * Create the initial Konva page canvas and initialize all fields and interactions.
   */
  const createPageCanvas = (container: HTMLDivElement) => {
    stage.current = new Konva.Stage({
      container,
      width: viewport.width,
      height: viewport.height,
    });

    // Create the main layer for interactive elements.
    pageLayer.current = new Konva.Layer();
    stage.current?.add(pageLayer.current);

    // Initialize snap guides layer
    // snapGuideLayer.current = initializeSnapGuides(stage.current);

    // Add transformer for resizing and rotating.
    interactiveTransformer.current = createInteractiveTransformer(stage.current, pageLayer.current);

    // Render the fields.
    for (const field of localPageFields) {
      renderFieldOnLayer(field);
    }

    // Handle stage click to deselect.
    stage.current?.on('click', (e) => {
      removePendingField();

      if (e.target === stage.current) {
        setSelectedFields([]);
        pageLayer.current?.batchDraw();
      }
    });

    // When an item is dragged, select it automatically.
    const onDragStartOrEnd = (e: KonvaEventObject<Event>) => {
      removePendingField();

      if (!e.target.hasName('field-group')) {
        return;
      }

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
    };

    stage.current?.on('dragstart', onDragStartOrEnd);
    stage.current?.on('dragend', onDragStartOrEnd);
    stage.current?.on('transformstart', () => setIsFieldChanging(true));
    stage.current?.on('transformend', () => setIsFieldChanging(false));

    pageLayer.current.batchDraw();
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
  const createInteractiveTransformer = (stage: Konva.Stage, layer: Konva.Layer) => {
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

    layer.add(transformer);

    // Add selection rectangle.
    const selectionRectangle = new Konva.Rect({
      fill: 'rgba(24, 160, 251, 0.3)',
      visible: false,
    });
    layer.add(selectionRectangle);

    let x1: number;
    let y1: number;
    let x2: number;
    let y2: number;

    stage.on('mousedown touchstart', (e) => {
      // do nothing if we mousedown on any shape
      if (e.target !== stage) {
        return;
      }

      const pointerPosition = stage.getPointerPosition();

      if (!pointerPosition) {
        return;
      }

      x1 = pointerPosition.x;
      y1 = pointerPosition.y;
      x2 = pointerPosition.x;
      y2 = pointerPosition.y;

      selectionRectangle.setAttrs({
        x: x1,
        y: y1,
        width: 0,
        height: 0,
        visible: true,
      });
    });

    stage.on('mousemove touchmove', () => {
      // do nothing if we didn't start selection
      if (!selectionRectangle.visible()) {
        return;
      }

      selectionRectangle.moveToTop();

      const pointerPosition = stage.getPointerPosition();

      if (!pointerPosition) {
        return;
      }

      x2 = pointerPosition.x;
      y2 = pointerPosition.y;

      selectionRectangle.setAttrs({
        x: Math.min(x1, x2),
        y: Math.min(y1, y2),
        width: Math.abs(x2 - x1),
        height: Math.abs(y2 - y1),
      });
    });

    stage.on('mouseup touchend', () => {
      // do nothing if we didn't start selection
      if (!selectionRectangle.visible()) {
        return;
      }

      // Update visibility in timeout, so we can check it in click event
      setTimeout(() => {
        selectionRectangle.visible(false);
      });

      const stageFieldGroups = stage.find('.field-group') || [];
      const box = selectionRectangle.getClientRect();
      const selectedFieldGroups = stageFieldGroups.filter(
        (shape) => Konva.Util.haveIntersection(box, shape.getClientRect()) && shape.draggable(),
      );
      setSelectedFields(selectedFieldGroups);

      // Create a field if no items are selected or the size is too small.
      if (
        selectedFieldGroups.length === 0 &&
        canvasElement.current &&
        box.width > MIN_FIELD_WIDTH_PX &&
        box.height > MIN_FIELD_HEIGHT_PX &&
        editorFields.selectedRecipient &&
        canRecipientFieldsBeModified(editorFields.selectedRecipient, envelope.fields)
      ) {
        const pendingFieldCreation = new Konva.Rect({
          name: 'pending-field-creation',
          x: box.x,
          y: box.y,
          width: box.width,
          height: box.height,
          fill: 'rgba(24, 160, 251, 0.3)',
        });

        layer.add(pendingFieldCreation);
        setPendingFieldCreation(pendingFieldCreation);
      }
    });

    // Clicks should select/deselect shapes
    stage.on('click tap', function (e) {
      // if we are selecting with rect, do nothing
      if (
        selectionRectangle.visible() &&
        selectionRectangle.width() > 0 &&
        selectionRectangle.height() > 0
      ) {
        return;
      }

      // If empty area clicked, remove all selections
      if (e.target === stage) {
        setSelectedFields([]);
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
        console.log('Field removed, removing from canvas');
        group.destroy();
      }
    });

    // If it exists, rerender.
    localPageFields.forEach((field) => {
      console.log('Field created/updated, rendering on canvas');
      renderFieldOnLayer(field);
    });

    // If it doesn't exist, render it.
    //

    // Rerender the transformer
    interactiveTransformer.current?.forceUpdate();

    pageLayer.current.batchDraw();
  }, [localPageFields]);

  const setSelectedFields = (nodes: Konva.Node[]) => {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const fieldGroups = nodes.filter((node) => node.hasName('field-group')) as Konva.Group[];

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

    if (!canvasElement.current || !currentEnvelopeItem || !editorFields.selectedRecipient) {
      return;
    }

    const { height: pageHeight, width: pageWidth } = getBoundingClientRect(canvasElement.current);

    const { fieldX, fieldY, fieldWidth, fieldHeight } = convertPixelToPercentage({
      width: pixelWidth,
      height: pixelHeight,
      positionX: pixelX,
      positionY: pixelY,
      pageWidth,
      pageHeight,
    });

    editorFields.addField({
      envelopeItemId: currentEnvelopeItem.id,
      page: pageContext.pageNumber,
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
    <div className="relative" key={`${currentEnvelopeItem.id}-renderer-${pageContext.pageNumber}`}>
      {selectedKonvaFieldGroups.length > 0 &&
        interactiveTransformer.current &&
        !isFieldChanging && (
          <div
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
            className="group flex items-center justify-evenly gap-x-1 rounded-md border bg-gray-900 p-0.5"
          >
            <button
              title={t`Duplicate`}
              className="rounded-sm p-1.5 text-gray-400 transition-colors hover:bg-white/10 hover:text-gray-100"
              onClick={() => duplicatedSelectedFields()}
              onTouchEnd={() => duplicatedSelectedFields()}
            >
              <CopyPlusIcon className="h-3 w-3" />
            </button>

            <button
              title={t`Duplicate on all pages`}
              className="rounded-sm p-1.5 text-gray-400 transition-colors hover:bg-white/10 hover:text-gray-100"
              onClick={() => duplicatedSelectedFieldsOnAllPages()}
              onTouchEnd={() => duplicatedSelectedFieldsOnAllPages()}
            >
              <SquareStackIcon className="h-3 w-3" />
            </button>

            <button
              title={t`Remove`}
              className="rounded-sm p-1.5 text-gray-400 transition-colors hover:bg-white/10 hover:text-gray-100"
              onClick={() => deletedSelectedFields()}
              onTouchEnd={() => deletedSelectedFields()}
            >
              <TrashIcon className="h-3 w-3" />
            </button>
          </div>
        )}

      {/* Todo: Envelopes - This will not overflow the page when close to edges */}
      {pendingFieldCreation && (
        <div
          style={{
            position: 'absolute',
            top: pendingFieldCreation.y() + pendingFieldCreation.getClientRect().height + 5 + 'px',
            left: pendingFieldCreation.x() + pendingFieldCreation.getClientRect().width / 2 + 'px',
            transform: 'translateX(-50%)',
            zIndex: 50,
          }}
          className="text-muted-foreground grid w-fit grid-cols-5 gap-x-1 gap-y-0.5 rounded-md border bg-white p-1 shadow-sm"
        >
          {fieldButtonList.map((field) => (
            <button
              key={field.type}
              onClick={() => createFieldFromPendingTemplate(pendingFieldCreation, field.type)}
              className="hover:text-foreground col-span-1 w-full flex-shrink-0 rounded-sm px-2 py-1 text-xs hover:bg-gray-100"
            >
              {t(field.name)}
            </button>
          ))}
        </div>
      )}

      <div className="konva-container absolute inset-0 z-10" ref={konvaContainer}></div>

      <canvas
        className={`${_className}__canvas z-0`}
        height={viewport.height}
        ref={canvasElement}
        width={viewport.width}
      />
    </div>
  );
}
