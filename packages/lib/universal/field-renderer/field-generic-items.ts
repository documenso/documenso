import { DEFAULT_RECT_BACKGROUND, getRecipientColorStyles } from '@documenso/ui/lib/recipient-colors';
import Konva from 'konva';

import type { FieldToRender, RenderFieldElementOptions } from './field-renderer';
import { calculateFieldPosition } from './field-renderer';

export const konvaTextFontFamily =
  '"Noto Sans", "Noto Sans Japanese", "Noto Sans Chinese", "Noto Sans Korean", sans-serif';
export const konvaTextFill = 'black';

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
    strokeWidth: fieldCanvasStyle?.borderWidth ?? 2,
    cornerRadius: fieldCanvasStyle?.borderRadius ?? 2,
    strokeScaleEnabled: false,
    visible: mode !== 'export',
  } satisfies Partial<Konva.RectConfig>);

  return fieldRect;
};

export const FIELD_SPINNER_NAME = 'loading-spinner-group';

export const createSpinner = ({ fieldWidth, fieldHeight }: { fieldWidth: number; fieldHeight: number }) => {
  const loadingGroup = new Konva.Group({
    name: FIELD_SPINNER_NAME,
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

/**
 * Shows or hides the loading spinner on a rendered field.
 */
export const syncFieldSpinner = (fieldGroup: Konva.Group, isSigning: boolean) => {
  const existingSpinner = fieldGroup.findOne(`.${FIELD_SPINNER_NAME}`);

  if (!isSigning) {
    existingSpinner?.destroy();
    return;
  }

  if (existingSpinner) {
    return;
  }

  const fieldRect = fieldGroup.findOne('.field-rect');

  fieldGroup.add(
    createSpinner({
      fieldWidth: fieldRect ? fieldRect.width() : fieldGroup.width(),
      fieldHeight: fieldRect ? fieldRect.height() : fieldGroup.height(),
    }),
  );
};

export const FIELD_GROUP_HIGHLIGHT_NAME = 'group-highlight';

const FIELD_GROUP_HIGHLIGHT_OPACITY: Record<FieldGroupHighlightLevel, number> = {
  focused: 0.3,
  member: 0.06,
};

const FIELD_GROUP_HIGHLIGHT_FADE_SECONDS = 0.3;
const FIELD_GROUP_HIGHLIGHT_TWEEN_ATTR = 'groupHighlightTween';

/**
 * How strongly a field is tinted as part of a highlighted group. The focused field is
 * tinted like a hovered field and the other members more lightly.
 */
export type FieldGroupHighlightLevel = 'focused' | 'member';

/**
 * Adds, fades or removes the translucent overlay marking a rendered field as part of a
 * highlighted group. An overlay is used rather than changing the field's fill so it does
 * not fight the hover transition.
 */
export const syncFieldGroupHighlight = (fieldGroup: Konva.Group, level: FieldGroupHighlightLevel | null) => {
  const existingHighlight = fieldGroup.findOne(`.${FIELD_GROUP_HIGHLIGHT_NAME}`);

  if (!level) {
    if (existingHighlight) {
      tweenFieldGroupHighlight(existingHighlight, 0, () => existingHighlight.destroy());
    }

    return;
  }

  const opacity = FIELD_GROUP_HIGHLIGHT_OPACITY[level];

  if (existingHighlight) {
    tweenFieldGroupHighlight(existingHighlight, opacity);
    return;
  }

  const fieldRect = fieldGroup.findOne('.field-rect');

  if (!(fieldRect instanceof Konva.Rect)) {
    return;
  }

  const highlightRect = new Konva.Rect({
    name: FIELD_GROUP_HIGHLIGHT_NAME,
    width: fieldRect.width(),
    height: fieldRect.height(),
    cornerRadius: fieldRect.cornerRadius(),
    fill: fieldRect.stroke(),
    opacity: 0,
    listening: false,
  });

  fieldGroup.add(highlightRect);
  highlightRect.zIndex(fieldRect.zIndex() + 1);

  tweenFieldGroupHighlight(highlightRect, opacity);
};

/**
 * Fades a group highlight to the given opacity, replacing any fade already running on it
 * so rapid hover changes do not fight each other.
 */
const tweenFieldGroupHighlight = (highlight: Konva.Node, opacity: number, onFinish?: () => void) => {
  const existingTween = highlight.getAttr(FIELD_GROUP_HIGHLIGHT_TWEEN_ATTR);

  if (existingTween instanceof Konva.Tween) {
    existingTween.destroy();
  }

  const tween = new Konva.Tween({
    node: highlight,
    duration: FIELD_GROUP_HIGHLIGHT_FADE_SECONDS,
    opacity,
    onFinish: () => {
      highlight.setAttr(FIELD_GROUP_HIGHLIGHT_TWEEN_ATTR, null);
      onFinish?.();
    },
  });

  highlight.setAttr(FIELD_GROUP_HIGHLIGHT_TWEEN_ATTR, tween);
  tween.play();
};

type CreateFieldHoverInteractionOptions = {
  options: RenderFieldElementOptions;
  fieldGroup: Konva.Group;
  fieldRect: Konva.Rect;
};

/**
 * Adds smooth transition-like behavior for hover effects to the field group and rectangle.
 */
export const createFieldHoverInteraction = ({ options, fieldGroup, fieldRect }: CreateFieldHoverInteractionOptions) => {
  const { mode } = options;

  if (mode === 'export' || !options.color) {
    return;
  }

  if (options.fieldCanvasStyle?.backgroundColor) {
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
