import { DEFAULT_RECT_BACKGROUND, getRecipientColorStyles } from '@documenso/ui/lib/recipient-colors';
import Konva from 'konva';

import type { FieldToRender, RenderFieldElementOptions } from './field-renderer';
import { calculateFieldPosition } from './field-renderer';

export const konvaTextFontFamily =
  '"Noto Sans", "Noto Sans Japanese", "Noto Sans Chinese", "Noto Sans Korean", sans-serif';
export const konvaTextFill = 'black';

// Renderer defaults, shared between `upsertFieldRect` and the hover interaction so
// hover tweens return the field to its actual idle state rather than a guess.
const DEFAULT_FIELD_STROKE_WIDTH = 2;
const DEFAULT_FIELD_CORNER_RADIUS = 2;

export const upsertFieldGroup = (field: FieldToRender, options: RenderFieldElementOptions): Konva.Group => {
  const { pageWidth, pageHeight, pageLayer, editable, scale } = options;

  const { fieldX, fieldY, fieldWidth, fieldHeight } = calculateFieldPosition(field, pageWidth, pageHeight);

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
    opacity: options.fieldCanvasStyle?.opacity ?? 1,
    dragBoundFunc: (pos) => {
      const newX = Math.max(0, Math.min(maxXPosition, pos.x));
      const newY = Math.max(0, Math.min(maxYPosition, pos.y));

      return { x: newX, y: newY };
    },
  } satisfies Partial<Konva.GroupConfig>);

  return fieldGroup;
};

export const upsertFieldRect = (field: FieldToRender, options: RenderFieldElementOptions): Konva.Rect => {
  const { pageWidth, pageHeight, mode, pageLayer, color } = options;
  const { fieldCanvasStyle } = options;

  const { fieldWidth, fieldHeight } = calculateFieldPosition(field, pageWidth, pageHeight);

  const fieldRect: Konva.Rect =
    pageLayer.findOne(`#${field.renderId}-rect`) ||
    new Konva.Rect({
      id: `${field.renderId}-rect`,
      name: 'field-rect',
    });

  fieldRect.setAttrs({
    width: fieldWidth,
    height: fieldHeight,
    fill: fieldCanvasStyle?.backgroundColor ?? DEFAULT_RECT_BACKGROUND,
    stroke: fieldCanvasStyle?.borderColor ?? (color ? getRecipientColorStyles(color).baseRing : '#e5e7eb'),
    strokeWidth: fieldCanvasStyle?.borderWidth ?? DEFAULT_FIELD_STROKE_WIDTH,
    cornerRadius: fieldCanvasStyle?.borderRadius ?? DEFAULT_FIELD_CORNER_RADIUS,
    strokeScaleEnabled: false,
    visible: mode !== 'export',
  } satisfies Partial<Konva.RectConfig>);

  return fieldRect;
};

export const createSpinner = ({ fieldWidth, fieldHeight }: { fieldWidth: number; fieldHeight: number }) => {
  const loadingGroup = new Konva.Group({
    name: 'loading-spinner-group',
    listening: false,
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

type FieldHoverTweenState = {
  fill: string;
  stroke: string;
  strokeWidth: number;
  cornerRadius: number;
  opacity: number;
};

/**
 * Adds smooth transition-like behavior for hover effects to the field group and rectangle.
 *
 * Resting and hover states both derive from the resolved field canvas style (read
 * from a probe, so custom embed CSS is honored — hover via the
 * `field--FieldRootContainerHover` class). Every canvas-handled property is
 * respected on hover: fill, stroke, stroke width, corner radius and opacity. When
 * the embedder hasn't customized a hover property (its probed value matches the
 * resting value), it falls back to the resting value — except the background,
 * which falls back to the default recipient hover color to preserve the built-in
 * hover effect for teams without custom branding.
 */
export const createFieldHoverInteraction = ({ options, fieldGroup, fieldRect }: CreateFieldHoverInteractionOptions) => {
  const { mode, color, fieldCanvasStyle } = options;

  if (mode === 'export' || !color) {
    return;
  }

  const recipientStyles = getRecipientColorStyles(color);

  const restingState: FieldHoverTweenState = {
    fill: fieldCanvasStyle?.backgroundColor ?? DEFAULT_RECT_BACKGROUND,
    stroke: fieldCanvasStyle?.borderColor ?? recipientStyles.baseRing,
    strokeWidth: fieldCanvasStyle?.borderWidth ?? DEFAULT_FIELD_STROKE_WIDTH,
    cornerRadius: fieldCanvasStyle?.borderRadius ?? DEFAULT_FIELD_CORNER_RADIUS,
    opacity: fieldCanvasStyle?.opacity ?? 1,
  };

  const hover = fieldCanvasStyle?.hover;

  // A hover prop is "customized" only when it differs from the resting value;
  // otherwise the hover class resolved to nothing and we keep the resting value.
  const pickHover = <T>(hoverValue: T | undefined, restingValue: T, customizedFallback: T): T => {
    if (hoverValue === undefined || hoverValue === restingValue) {
      return customizedFallback;
    }

    return hoverValue;
  };

  const hoverState: FieldHoverTweenState = {
    // Background is special: when uncustomized, fall back to the recipient hover
    // color rather than the resting fill so the default hover effect still shows.
    fill: pickHover(hover?.backgroundColor, restingState.fill, recipientStyles.baseRingHover),
    stroke: pickHover(hover?.borderColor, restingState.stroke, restingState.stroke),
    strokeWidth: pickHover(hover?.borderWidth, restingState.strokeWidth, restingState.strokeWidth),
    cornerRadius: pickHover(hover?.borderRadius, restingState.cornerRadius, restingState.cornerRadius),
    opacity: pickHover(hover?.opacity, restingState.opacity, restingState.opacity),
  };

  const tweenTo = (state: FieldHoverTweenState) => {
    if (!fieldRect.getLayer()) {
      return;
    }

    new Konva.Tween({
      node: fieldRect,
      duration: 0.3,
      fill: state.fill,
      stroke: state.stroke,
      strokeWidth: state.strokeWidth,
      cornerRadius: state.cornerRadius,
    }).play();

    new Konva.Tween({
      node: fieldGroup,
      duration: 0.3,
      opacity: state.opacity,
    }).play();
  };

  // Field groups are reused across re-renders (upserted via `findOne`), so clear
  // any previously-bound hover listeners before re-registering to avoid stacking.
  fieldGroup.off('mouseover.fieldHover mouseout.fieldHover transformstart.fieldHover transformend.fieldHover');

  fieldGroup.on('mouseover.fieldHover', () => tweenTo(hoverState));
  fieldGroup.on('mouseout.fieldHover', () => tweenTo(restingState));
  fieldGroup.on('transformstart.fieldHover', () => tweenTo(hoverState));
  fieldGroup.on('transformend.fieldHover', () => tweenTo(restingState));
};
