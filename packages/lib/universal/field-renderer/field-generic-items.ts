import Konva from 'konva';

import {
  DEFAULT_RECT_BACKGROUND,
  getRecipientColorStyles,
} from '@documenso/ui/lib/recipient-colors';

import type { FieldToRender, RenderFieldElementOptions } from './field-renderer';
import { calculateFieldPosition } from './field-renderer';

export const konvaTextFontFamily =
  '"Noto Sans", "Noto Sans Japanese", "Noto Sans Chinese", "Noto Sans Korean", sans-serif';
export const konvaTextFill = 'black';

/**
 * The outline drawn around each field in the exported/sealed PDF so that the
 * fillable areas remain visibly delineated on the completed document.
 *
 * A neutral grey is used (rather than the recipient colour shown while editing
 * and signing) to keep the final document looking clean and form-like.
 */
export const EXPORT_FIELD_OUTLINE_COLOR = '#9ca3af'; // tailwind grey-400
export const EXPORT_FIELD_OUTLINE_WIDTH = 1;

export const upsertFieldGroup = (
  field: FieldToRender,
  options: RenderFieldElementOptions,
): Konva.Group => {
  const { pageWidth, pageHeight, pageLayer, editable, scale } = options;

  const { fieldX, fieldY, fieldWidth, fieldHeight } = calculateFieldPosition(
    field,
    pageWidth,
    pageHeight,
  );

  const fieldGroup: Konva.Group =
    pageLayer.findOne(`#${field.renderId}`) ||
    new Konva.Group({
      id: field.renderId,
      name: 'field-group',
    });

  const maxXPosition = (pageWidth - fieldWidth) * scale;
  const maxYPosition = (pageHeight - fieldHeight) * scale;

  fieldGroup.setAttrs({
    scaleX: 1,
    scaleY: 1,
    x: fieldX,
    y: fieldY,
    draggable: editable,
    dragBoundFunc: (pos) => {
      const newX = Math.max(0, Math.min(maxXPosition, pos.x));
      const newY = Math.max(0, Math.min(maxYPosition, pos.y));

      return { x: newX, y: newY };
    },
  } satisfies Partial<Konva.GroupConfig>);

  return fieldGroup;
};

export const upsertFieldRect = (
  field: FieldToRender,
  options: RenderFieldElementOptions,
): Konva.Rect => {
  const { pageWidth, pageHeight, mode, pageLayer, color } = options;

  const { fieldWidth, fieldHeight } = calculateFieldPosition(field, pageWidth, pageHeight);

  const fieldRect: Konva.Rect =
    pageLayer.findOne(`#${field.renderId}-rect`) ||
    new Konva.Rect({
      id: `${field.renderId}-rect`,
      name: 'field-rect',
    });

  const isExport = mode === 'export';

  fieldRect.setAttrs({
    width: fieldWidth,
    height: fieldHeight,
    // In export mode keep the fill transparent so the underlying PDF content
    // shows through, while still drawing the field outline below.
    fill: isExport ? undefined : DEFAULT_RECT_BACKGROUND,
    stroke: isExport
      ? EXPORT_FIELD_OUTLINE_COLOR
      : color
        ? getRecipientColorStyles(color).baseRing
        : '#e5e7eb',
    strokeWidth: isExport ? EXPORT_FIELD_OUTLINE_WIDTH : 2,
    cornerRadius: 2,
    strokeScaleEnabled: false,
    // Previously the rectangle was hidden entirely when exporting; it is now
    // kept visible so the field outline is rendered on the final PDF.
    visible: true,
  } satisfies Partial<Konva.RectConfig>);

  return fieldRect;
};

export const createSpinner = ({
  fieldWidth,
  fieldHeight,
}: {
  fieldWidth: number;
  fieldHeight: number;
}) => {
  const loadingGroup = new Konva.Group({
    name: 'loading-spinner-group',
  });

  const rect = new Konva.Rect({
    x: 4,
    y: 4,
    width: fieldWidth - 8,
    height: fieldHeight - 8,
    fill: 'white',
    opacity: 0.8,
  });

  const maxSpinnerSize = 10;
  const smallerDimension = Math.min(fieldWidth, fieldHeight);
  const spinnerSize = Math.min(smallerDimension, maxSpinnerSize);

  const spinner = new Konva.Arc({
    x: fieldWidth / 2,
    y: fieldHeight / 2,
    innerRadius: spinnerSize,
    outerRadius: spinnerSize / 2,
    angle: 270,
    rotation: 0,
    fill: 'rgba(122, 195, 85, 1)',
    lineCap: 'round',
  });

  rect.moveToTop();
  spinner.moveToTop();

  loadingGroup.add(rect);
  loadingGroup.add(spinner);

  const anim = new Konva.Animation((frame) => {
    spinner.rotate(180 * (frame.timeDiff / 500));
  });

  anim.start();

  return loadingGroup;
};

type CreateFieldHoverInteractionOptions = {
  options: RenderFieldElementOptions;
  fieldGroup: Konva.Group;
  fieldRect: Konva.Rect;
};

/**
 * Adds smooth transition-like behavior for hover effects to the field group and rectangle.
 */
export const createFieldHoverInteraction = ({
  options,
  fieldGroup,
  fieldRect,
}: CreateFieldHoverInteractionOptions) => {
  const { mode } = options;

  if (mode === 'export' || !options.color) {
    return;
  }

  const hoverColor = getRecipientColorStyles(options.color).baseRingHover;

  fieldGroup.on('mouseover', () => {
    const layer = fieldRect.getLayer();
    if (!layer) {
      return;
    }

    new Konva.Tween({
      node: fieldRect,
      duration: 0.3,
      fill: hoverColor,
    }).play();
  });

  fieldGroup.on('mouseout', () => {
    const layer = fieldRect.getLayer();
    if (!layer) {
      return;
    }

    new Konva.Tween({
      node: fieldRect,
      duration: 0.3,
      fill: DEFAULT_RECT_BACKGROUND,
    }).play();
  });

  fieldGroup.on('transformstart', () => {
    const layer = fieldRect.getLayer();
    if (!layer) {
      return;
    }

    new Konva.Tween({
      node: fieldRect,
      duration: 0.3,
      fill: hoverColor,
    }).play();
  });

  fieldGroup.on('transformend', () => {
    const layer = fieldRect.getLayer();
    if (!layer) {
      return;
    }

    new Konva.Tween({
      node: fieldRect,
      duration: 0.3,
      fill: DEFAULT_RECT_BACKGROUND,
    }).play();
  });
};
