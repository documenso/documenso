import { useEffect, useMemo, useRef, useState } from 'react';

import { useLingui } from '@lingui/react/macro';
import type { FieldType } from '@prisma/client';
import Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { Transformer } from 'konva/lib/shapes/Transformer';
import { CopyPlusIcon, SquareStackIcon, TrashIcon, UserCircleIcon } from 'lucide-react';

import type { TLocalField } from '@documenso/lib/client-only/hooks/use-editor-fields';
import { usePageRenderer } from '@documenso/lib/client-only/hooks/use-page-renderer';
import { useCurrentEnvelopeEditor } from '@documenso/lib/client-only/providers/envelope-editor-provider';
import { useCurrentEnvelopeRender } from '@documenso/lib/client-only/providers/envelope-render-provider';
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

export default function EnvelopeEditorFieldsPageRenderer() {
  const { t, i18n } = useLingui();
  const { envelope, editorFields, getRecipientColorKey } = useCurrentEnvelopeEditor();
  const { currentEnvelopeItem, setRenderError } = useCurrentEnvelopeRender();

  const interactiveTransformer = useRef<Transformer | null>(null);

  const [selectedKonvaFieldGroups, setSelectedKonvaFieldGroups] = useState<Konva.Group[]>([]);

  const [isFieldChanging, setIsFieldChanging] = useState(false);
  const [pendingFieldCreation, setPendingFieldCreation] = useState<Konva.Rect | null>(null);

  const {
    stage,
    pageLayer,
    canvasElement,
    konvaContainer,
    pageContext,
    scaledViewport,
    unscaledViewport,
  } = usePageRenderer(({ stage, pageLayer }) => createPageCanvas(stage, pageLayer));

  const { _className, scale } = pageContext;

  const localPageFields = useMemo(
    () =>
      editorFields.localFields.filter(
        (field) =>
          field.page === pageContext.pageNumber && field.envelopeItemId === currentEnvelopeItem?.id,
      ),
    [editorFields.localFields, pageContext.pageNumber],
  );

  const handleResizeOrMove = (event: KonvaEventObject<Event>) => {
    const { current: container } = canvasElement;

    if (!container) {
      return;
    }

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

  /**
   * Initialize the Konva page canvas and all fields and interactions.
   */
  const createPageCanvas = (currentStage: Konva.Stage, currentPageLayer: Konva.Layer) => {
    // Initialize snap guides layer
    // snapGuideLayer.current = initializeSnapGuides(stage.current);

    // Add transformer for resizing and rotating.
    interactiveTransformer.current = createInteractiveTransformer(currentStage, currentPageLayer);

    // Render the fields.
    for (const field of localPageFields) {
      renderFieldOnLayer(field);
    }

    // Handle stage click to deselect.
    currentStage.on('mousedown', (e) => {
      removePendingField();

      if (e.target === stage.current) {
        setSelectedFields([]);
        currentPageLayer.batchDraw();
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

    currentStage.on('dragstart', onDragStartOrEnd);
    currentStage.on('dragend', onDragStartOrEnd);
    currentStage.on('transformstart', () => setIsFieldChanging(true));
    currentStage.on('transformend', () => setIsFieldChanging(false));

    currentPageLayer.batchDraw();
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
        canvasElement.current &&
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

    if (!canvasElement.current || !currentEnvelopeItem || !editorFields.selectedRecipient) {
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
    <div
      className="relative w-full"
      key={`${currentEnvelopeItem.id}-renderer-${pageContext.pageNumber}`}
    >
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

      {/* Canvas the PDF will be rendered on. */}
      <canvas
        className={`${_className}__canvas z-0`}
        ref={canvasElement}
        height={scaledViewport.height}
        width={scaledViewport.width}
      />
    </div>
  );
}

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
  }, [editorFields.localFields]);

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
