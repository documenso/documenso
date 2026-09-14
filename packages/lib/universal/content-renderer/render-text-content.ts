import Konva from 'konva';

import type { TContentTextMeta } from '../../types/envelope-content-meta';
import {
  DEFAULT_CONTENT_FONT_SIZE,
  DEFAULT_CONTENT_TEXT,
  DEFAULT_CONTENT_TEXT_COLOR,
} from '../../types/envelope-content-meta';
import type { TFieldOverflowMode } from '../../types/field-meta';
import {
  FIELD_DEFAULT_GENERIC_ALIGN,
  FIELD_DEFAULT_LETTER_SPACING,
  FIELD_DEFAULT_LINE_HEIGHT,
} from '../../types/field-meta';
import { calculateOverflowLayout } from '../field-renderer/calculate-overflow-layout';
import { konvaTextFontFamily } from '../field-renderer/field-generic-items';
import {
  createContentHoverInteraction,
  upsertContentGroup,
  upsertContentGroupChild,
  upsertContentHitRect,
} from './content-generic-items';
import type { ContentToRender, RenderContentOptions } from './content-renderer';
import {
  CONTENT_DEFAULT_STROKE_WIDTH,
  CONTENT_PLACEHOLDER_STROKE_COLOR,
  CONTENT_TRANSPARENT_FILL,
  calculateContentBoxGeometry,
  isContentEditorGuidesVisible,
} from './content-renderer';

/**
 * Text contents are laid out within the box the author drew and never grow
 * past it. This is not configurable since content should not be dynamic.
 */
const CONTENT_TEXT_OVERFLOW_MODE: TFieldOverflowMode = 'crop';

export const renderTextContentElement = (
  content: ContentToRender,
  meta: TContentTextMeta,
  options: RenderContentOptions,
): Konva.Group => {
  const { pageWidth, pageHeight } = options;

  const geometry = calculateContentBoxGeometry(meta, pageWidth, pageHeight);

  const contentGroup = upsertContentGroup(content, options, {
    ...geometry,
    rotation: meta.rotation ?? 0,
  });

  const contentText = upsertContentGroupChild(
    contentGroup,
    `${content.renderId}-text`,
    () =>
      new Konva.Text({
        name: 'content-text',
        listening: false,
      }),
  );

  // Text contents are always real document content, so there is no
  // placeholder state. Fall back to the default text if none is set.
  const textToRender = meta.text || DEFAULT_CONTENT_TEXT;

  const fontSize = meta.fontSize ?? DEFAULT_CONTENT_FONT_SIZE;
  const textAlign = meta.textAlign ?? FIELD_DEFAULT_GENERIC_ALIGN;
  const verticalAlign = meta.verticalAlign ?? 'top';
  const lineHeight = meta.lineHeight ?? FIELD_DEFAULT_LINE_HEIGHT;
  const letterSpacing = meta.letterSpacing ?? FIELD_DEFAULT_LETTER_SPACING;
  const color = meta.color ?? DEFAULT_CONTENT_TEXT_COLOR;

  const overflowLayout = calculateOverflowLayout({
    overflowMode: CONTENT_TEXT_OVERFLOW_MODE,
    isLabel: false,
    textToRender,
    fontSize,
    fontFamily: konvaTextFontFamily,
    lineHeight,
    letterSpacing,
    textAlign,
    verticalAlign,
    baseX: 0,
    baseY: 0,
    baseWidth: geometry.width,
    baseHeight: geometry.height,
    groupX: geometry.x,
    groupY: geometry.y,
    pageWidth,
    pageHeight,
  });

  contentText.setAttrs({
    visible: true,
    scaleX: 1,
    scaleY: 1,
    x: overflowLayout.x,
    y: overflowLayout.y,
    width: overflowLayout.width,
    height: overflowLayout.height,
    wrap: overflowLayout.wrap,
    align: overflowLayout.textAlign,
    verticalAlign: overflowLayout.verticalAlign,
    text: textToRender,
    fontSize,
    fontFamily: konvaTextFontFamily,
    lineHeight,
    letterSpacing,
    fill: color,
  } satisfies Partial<Konva.TextConfig>);

  const hitRect = upsertContentHitRect(contentGroup, content, geometry.width, geometry.height);

  // A persistent dashed outline marks the text box bounds while editing,
  // matching the image placeholder treatment, since the text itself
  // gives no indication of the box it is laid out within.
  const boundsRect = upsertContentGroupChild(
    contentGroup,
    `${content.renderId}-bounds-rect`,
    () =>
      new Konva.Rect({
        name: 'content-bounds-rect',
        listening: false,
        dash: [6, 4],
        fill: CONTENT_TRANSPARENT_FILL,
        strokeScaleEnabled: false,
      }),
  );

  boundsRect.setAttrs({
    visible: isContentEditorGuidesVisible(options),
    x: 0,
    y: 0,
    width: geometry.width,
    height: geometry.height,
    stroke: CONTENT_PLACEHOLDER_STROKE_COLOR,
    strokeWidth: CONTENT_DEFAULT_STROKE_WIDTH,
  } satisfies Partial<Konva.RectConfig>);

  // Keep the text above the outline so the dashes never cross the glyphs.
  contentText.moveToTop();

  createContentHoverInteraction(contentGroup, content, options, geometry.width, geometry.height);

  contentGroup.off('transform.contentText');
  contentGroup.off('transformend.contentText');

  // The transformer resizes by scaling the group. Counter-scale the text so it
  // keeps its real size while the box visibly resizes, laying it out against
  // the scaled bounds in unscaled units. Mirrors the generic text field.
  contentGroup.on('transform.contentText', () => {
    const groupScaleX = contentGroup.scaleX();
    const groupScaleY = contentGroup.scaleY();

    contentText.scaleX(1 / groupScaleX);
    contentText.scaleY(1 / groupScaleY);

    const scaledWidth = hitRect.width() * groupScaleX;
    const scaledHeight = hitRect.height() * groupScaleY;

    // During the active transform use the crop bounds (content box only).
    contentText.x(0);
    contentText.y(0);
    contentText.width(scaledWidth);
    contentText.height(scaledHeight);
    contentText.wrap('word');

    contentGroup.getLayer()?.batchDraw();
  });

  // Once the gesture settles, recalculate the overflow layout against the new
  // box dimensions. The page renderer subsequently re-renders from the
  // persisted geometry, which resets the group scale.
  contentGroup.on('transformend.contentText', () => {
    const groupScaleX = contentGroup.scaleX();
    const groupScaleY = contentGroup.scaleY();

    contentText.scaleX(1);
    contentText.scaleY(1);

    const newWidth = hitRect.width() * groupScaleX;
    const newHeight = hitRect.height() * groupScaleY;

    const newOverflowLayout = calculateOverflowLayout({
      overflowMode: CONTENT_TEXT_OVERFLOW_MODE,
      isLabel: false,
      textToRender,
      fontSize,
      fontFamily: konvaTextFontFamily,
      lineHeight,
      letterSpacing,
      textAlign,
      verticalAlign,
      baseX: 0,
      baseY: 0,
      baseWidth: newWidth,
      baseHeight: newHeight,
      groupX: contentGroup.x(),
      groupY: contentGroup.y(),
      pageWidth,
      pageHeight,
    });

    contentText.x(newOverflowLayout.x);
    contentText.y(newOverflowLayout.y);
    contentText.width(newOverflowLayout.width);
    contentText.height(newOverflowLayout.height);
    contentText.wrap(newOverflowLayout.wrap);
    contentText.verticalAlign(newOverflowLayout.verticalAlign);

    contentGroup.getLayer()?.batchDraw();
  });

  return contentGroup;
};
