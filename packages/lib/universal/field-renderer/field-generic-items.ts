import { FieldType } from '@prisma/client';
import Konva from 'konva';

import {
  DEFAULT_RECT_BACKGROUND,
  getRecipientColorStyles,
} from '@documenso/ui/lib/recipient-colors';

import type { FieldToRender, RenderFieldElementOptions } from './field-renderer';
import { calculateFieldPosition } from './field-renderer';

/**
 * A fully transparent fill used (instead of {@link DEFAULT_RECT_BACKGROUND}) for
 * the resting state of checkbox/radio fields in the signer view. Kept as an
 * `rgba()` string rather than `undefined` so Konva tweens can animate to/from it.
 */
export const TRANSPARENT_RECT_BACKGROUND = 'rgba(255, 255, 255, 0)';

/**
 * Checkbox/radio fields are frequently placed over pre-printed form text. In the
 * signer view we keep their rect transparent so that underlying text stays
 * legible; every other field/mode keeps the standard near-opaque background.
 */
export const getFieldRestingFill = (
  field: Pick<FieldToRender, 'type'>,
  mode: RenderFieldElementOptions['mode'],
): string => {
  const isCheckboxOrRadio = field.type === FieldType.CHECKBOX || field.type === FieldType.RADIO;

  if (mode === 'sign' && isCheckboxOrRadio) {
    return TRANSPARENT_RECT_BACKGROUND;
  }

  return DEFAULT_RECT_BACKGROUND;
};

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

// Horizontal padding and distance from the bottom edge for the optional field
// line. Kept small so the line spans most of the field and sits just below any
// rendered value/signature.
export const FIELD_LINE_X_PADDING = 4;
export const FIELD_LINE_BOTTOM_OFFSET = 4;

/**
 * Positions a field's optional "signature line" as a horizontal rule spanning
 * the (padded) width of the field, near its bottom edge. Width/height are given
 * in the same space the line is drawn in (i.e. already account for any group
 * scaling that the caller counter-scales the line by).
 */
export const setFieldLinePoints = (line: Konva.Line, width: number, height: number) => {
  const y = Math.max(0, height - FIELD_LINE_BOTTOM_OFFSET);
  const endX = Math.max(FIELD_LINE_X_PADDING, width - FIELD_LINE_X_PADDING);

  line.points([FIELD_LINE_X_PADDING, y, endX, y]);
};

/**
 * Creates (or reuses) the horizontal line drawn beneath a field when its
 * `showLine` meta flag is enabled. Visible in every render mode, including
 * export, so it is sealed into the final PDF.
 */
export const upsertFieldLine = (
  field: FieldToRender,
  options: RenderFieldElementOptions,
): Konva.Line => {
  const { pageWidth, pageHeight, pageLayer } = options;

  const { fieldWidth, fieldHeight } = calculateFieldPosition(field, pageWidth, pageHeight);

  const fieldLine: Konva.Line =
    pageLayer.findOne(`#${field.renderId}-line`) ||
    new Konva.Line({
      id: `${field.renderId}-line`,
      name: 'field-line',
    });

  fieldLine.setAttrs({
    stroke: konvaTextFill,
    strokeWidth: 1,
    strokeScaleEnabled: false,
    listening: false,
  } satisfies Partial<Konva.LineConfig>);

  setFieldLinePoints(fieldLine, fieldWidth, fieldHeight);

  return fieldLine;
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

  // Checkbox/radio fields in the signer view get a faded, thinner outline and a
  // transparent background so they do not obscure the document text they sit on.
  const isFadedSignerField =
    mode === 'sign' && (field.type === FieldType.CHECKBOX || field.type === FieldType.RADIO);

  fieldRect.setAttrs({
    width: fieldWidth,
    height: fieldHeight,
    // In export mode keep the fill transparent so the underlying PDF content
    // shows through, while still drawing the field outline below.
    fill: isExport ? undefined : getFieldRestingFill(field, mode),
    stroke: isExport
      ? EXPORT_FIELD_OUTLINE_COLOR
      : color
        ? isFadedSignerField
          ? getRecipientColorStyles(color).baseRingFaded
          : getRecipientColorStyles(color).baseRing
        : '#e5e7eb',
    strokeWidth: isExport ? EXPORT_FIELD_OUTLINE_WIDTH : isFadedSignerField ? 1 : 2,
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
  field: Pick<FieldToRender, 'type'>;
};

/**
 * Adds smooth transition-like behavior for hover effects to the field group and rectangle.
 */
export const createFieldHoverInteraction = ({
  options,
  fieldGroup,
  fieldRect,
  field,
}: CreateFieldHoverInteractionOptions) => {
  const { mode } = options;

  if (mode === 'export' || !options.color) {
    return;
  }

  const hoverColor = getRecipientColorStyles(options.color).baseRingHover;

  // Resting fill the rect returns to when the pointer leaves / a transform ends.
  // For faded signer fields this is transparent so text stays legible.
  const restingFill = getFieldRestingFill(field, mode);

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
      fill: restingFill,
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
      fill: restingFill,
    }).play();
  });
};
