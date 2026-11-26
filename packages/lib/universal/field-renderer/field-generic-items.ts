import { DEFAULT_RECT_BACKGROUND, getRecipientColorStyles } from '@documenso/ui/lib/recipient-colors';
import Konva from 'konva';

import { resolvePrimaryColor } from './field-canvas-style';
import type { FieldToRender, RenderFieldElementOptions } from './field-renderer';
import { calculateFieldPosition } from './field-renderer';

export const konvaTextFontFamily =
  '"Noto Sans", "Noto Sans Japanese", "Noto Sans Chinese", "Noto Sans Korean", sans-serif';
export const konvaTextFill = 'black';

export const FIELD_SPINNER_NAME = 'loading-spinner-group';
export const FIELD_GROUP_HIGHLIGHT_NAME = 'group-highlight';

const FIELD_GROUP_HIGHLIGHT_FADE_SECONDS = 0.3;
const FIELD_GROUP_HIGHLIGHT_TWEEN_ATTR = 'groupHighlightTween';

const FIELD_FILL_FADE_SECONDS = 0.3;
const FIELD_FILL_TWEEN_ATTR = 'fillTween';
const FIELD_FILL_PROGRESS_ATTR = 'fillProgress';

const FIELD_HOVER_EVENT_NAME = 'fieldHover';
const FIELD_IS_HOVERED_ATTR = 'isFieldHovered';

const FIELD_GROUP_HIGHLIGHT_OPACITY: Record<FieldGroupHighlightLevel, number> = {
  primary: 0.3,
  secondary: 0.06,
};

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
    fill: resolvePrimaryColor() ?? 'rgba(122, 195, 85, 1)',
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

/**
 * How strongly a field is tinted as part of a highlighted group. Primary is tinted like a
 * hovered field and secondary more lightly.
 */
export type FieldGroupHighlightLevel = 'primary' | 'secondary';

type SyncFieldGroupHighlightOptions = {
  /**
   * Whether a newly added highlight fades in. Renderers clear a field's children on every
   * render, so redraws pass false to avoid the highlight flickering.
   */
  isAnimated?: boolean;
};

/**
 * Adds, fades or removes the translucent overlay marking a rendered field as part of a
 * highlighted group. An overlay is used rather than changing the field's fill so it does
 * not fight the hover transition.
 */
export const syncFieldGroupHighlight = (
  fieldGroup: Konva.Group,
  level: FieldGroupHighlightLevel | null,
  { isAnimated = true }: SyncFieldGroupHighlightOptions = {},
) => {
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
    opacity: isAnimated ? 0 : opacity,
    listening: false,
  });

  fieldGroup.add(highlightRect);
  highlightRect.zIndex(fieldRect.zIndex() + 1);

  if (isAnimated) {
    tweenFieldGroupHighlight(highlightRect, opacity);
  }
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
      tween.destroy();
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
 *
 * Uses enter and leave rather than over and out, which fire whenever the pointer crosses
 * from one of the field's shapes to another and would restart the fade each time.
 */
export const createFieldHoverInteraction = ({ options, fieldGroup, fieldRect }: CreateFieldHoverInteractionOptions) => {
  // This runs on every render of the field, so the listeners of the last render are removed.
  fieldGroup.off(`.${FIELD_HOVER_EVENT_NAME}`);

  const { mode, fieldCanvasStyle } = options;

  if (mode === 'export' || !options.color) {
    return;
  }

  // Do not tint if custom colors are passed in.
  if (fieldCanvasStyle?.backgroundColor || fieldCanvasStyle?.borderColor) {
    return;
  }

  const hoverColor = getRecipientColorStyles(options.color).baseRingHover;

  const setIsHovered = (isHovered: boolean) => {
    fieldGroup.setAttr(FIELD_IS_HOVERED_ATTR, isHovered);
    tweenFieldRectFill(fieldRect, isHovered ? hoverColor : DEFAULT_RECT_BACKGROUND);
  };

  fieldGroup.on(`mouseenter.${FIELD_HOVER_EVENT_NAME}`, () => setIsHovered(true));
  fieldGroup.on(`mouseleave.${FIELD_HOVER_EVENT_NAME}`, () => setIsHovered(false));
  fieldGroup.on(`transformstart.${FIELD_HOVER_EVENT_NAME}`, () => tweenFieldRectFill(fieldRect, hoverColor));
  fieldGroup.on(`transformend.${FIELD_HOVER_EVENT_NAME}`, () => tweenFieldRectFill(fieldRect, DEFAULT_RECT_BACKGROUND));

  const stage = fieldGroup.getStage();

  if (!stage || fieldGroup.getAttr(FIELD_IS_HOVERED_ATTR) !== true) {
    return;
  }

  // The field was redrawn while hovered. Konva only reports the pointer entering the new
  // rect once it moves, so the rect starts in the hover colour to keep the tint.
  fieldRect.fill(hoverColor);

  // Konva tracked the pointer through a shape which this render removed, so it will not
  // report the pointer leaving. The next pointer event settles whether it is still here.
  const stageEventName = `${FIELD_HOVER_EVENT_NAME}-${fieldGroup.id()}`;

  stage.off(`.${stageEventName}`);

  stage.on(`mousemove.${stageEventName} mouseleave.${stageEventName}`, (event) => {
    stage.off(`.${stageEventName}`);

    const hasPointerLeft = event.type === 'mouseleave' || !isPointerOverNode(stage, fieldGroup);

    if (hasPointerLeft) {
      setIsHovered(false);
    }
  });
};

const isPointerOverNode = (stage: Konva.Stage, node: Konva.Node): boolean => {
  const pointerPosition = stage.getPointerPosition();

  if (!pointerPosition) {
    return false;
  }

  const { x, y, width, height } = node.getClientRect();

  return (
    pointerPosition.x >= x &&
    pointerPosition.x <= x + width &&
    pointerPosition.y >= y &&
    pointerPosition.y <= y + height
  );
};

/**
 * Fades a field's fill to the given colour.
 *
 * Konva would interpolate the colour and its alpha separately. The fill fades between a
 * nearly opaque white and a translucent recipient colour, so the field would look darkest
 * part way through and then lighten. Mixing the premultiplied colours instead keeps the
 * visible colour moving in one direction, whatever is behind the field.
 */
const tweenFieldRectFill = (fieldRect: Konva.Rect, fill: string) => {
  if (!fieldRect.getLayer()) {
    return;
  }

  const existingTween = fieldRect.getAttr(FIELD_FILL_TWEEN_ATTR);

  // The fill is set from the progress attribute on every frame, so a tween left running
  // would keep painting its own colours over the new one.
  if (existingTween instanceof Konva.Tween) {
    existingTween.destroy();
  }

  const currentFill = fieldRect.fill();
  const from = Konva.Util.colorToRGBA(typeof currentFill === 'string' ? currentFill : fill);
  const to = Konva.Util.colorToRGBA(fill);

  if (!from || !to) {
    fieldRect.fill(fill);
    return;
  }

  fieldRect.setAttr(FIELD_FILL_PROGRESS_ATTR, 0);

  const tween = new Konva.Tween({
    node: fieldRect,
    duration: FIELD_FILL_FADE_SECONDS,
    [FIELD_FILL_PROGRESS_ATTR]: 1,
    onUpdate: () => {
      const progress: number = fieldRect.getAttr(FIELD_FILL_PROGRESS_ATTR);
      const alpha = from.a + (to.a - from.a) * progress;

      const mixChannel = (fromChannel: number, toChannel: number) =>
        alpha === 0 ? 0 : Math.round((fromChannel * from.a * (1 - progress) + toChannel * to.a * progress) / alpha);

      fieldRect.fill(
        `rgba(${mixChannel(from.r, to.r)}, ${mixChannel(from.g, to.g)}, ${mixChannel(from.b, to.b)}, ${alpha})`,
      );
    },
    onFinish: () => {
      tween.destroy();
      fieldRect.fill(fill);
      fieldRect.setAttr(FIELD_FILL_TWEEN_ATTR, null);
    },
  });

  fieldRect.setAttr(FIELD_FILL_TWEEN_ATTR, tween);
  tween.play();
};
