import Konva from 'konva';

import { AppError } from '../../errors/app-error';
import { DEFAULT_CONTENT_FONT_SIZE, EnvelopeContentType } from '../../types/envelope-content-meta';
import { konvaTextFontFamily } from '../field-renderer/field-generic-items';
import { renderBoxContent, upsertContentGroupChild, upsertContentHitRect } from './content-generic-items';
import type { ContentToRender, RenderContentOptions } from './content-renderer';
import {
  assertContentMetaType,
  calculateContainFit,
  isContentEditorGuidesVisible,
  KONVA_CONTENT_GUIDE_STROKE_COLOR,
  KONVA_CONTENT_GUIDE_STROKE_WIDTH,
  KONVA_CONTENT_PLACEHOLDER_TEXT_COLOR,
} from './content-renderer';

/**
 * Render an image content.
 *
 * The image is fitted within the content box preserving its aspect ratio.
 * The full box remains the content's bounds and clickable area, so resizing
 * and selection behave the same as other box contents.
 *
 * Until an image is attached (or while it is loading) a dashed placeholder
 * is shown instead, except when exporting.
 */
export const renderImageContentElement = (content: ContentToRender, options: RenderContentOptions): Konva.Group => {
  const { mode, translations, images } = options;

  const image = content.dataContentId ? images?.get(content.dataContentId) : undefined;

  if (mode === 'export' && content.dataContentId && !image) {
    throw new AppError('MISSING_CONTENT_IMAGE', {
      message: `The image of data content ${content.dataContentId} has not been loaded`,
    });
  }

  return renderBoxContent(content, options, ({ contentGroup, meta: boxMeta, geometry }) => {
    const meta = assertContentMetaType(boxMeta, EnvelopeContentType.IMAGE);

    upsertContentHitRect(contentGroup, content, geometry.width, geometry.height);

    const imageNode = upsertContentGroupChild(
      contentGroup,
      `${content.renderId}-image`,
      () =>
        new Konva.Image({
          name: 'content-image',
          listening: false,
          image: undefined,
        }),
    );

    if (image) {
      imageNode.setAttrs({
        visible: true,
        image,
        ...calculateContainFit({ width: image.width, height: image.height }, geometry),
      } satisfies Partial<Konva.ImageConfig>);
    } else {
      imageNode.setAttrs({
        visible: false,
        image: undefined,
      } satisfies Partial<Konva.ImageConfig>);
    }

    const placeholderRect = upsertContentGroupChild(
      contentGroup,
      `${content.renderId}-placeholder-rect`,
      () =>
        new Konva.Rect({
          name: 'content-placeholder-rect',
          listening: false,
          dash: [6, 4],
        }),
    );

    const placeholderText = upsertContentGroupChild(
      contentGroup,
      `${content.renderId}-placeholder-text`,
      () =>
        new Konva.Text({
          name: 'content-placeholder-text',
          listening: false,
          align: 'center',
          verticalAlign: 'middle',
        }),
    );

    // Placeholders are editor guides: outside the content editor an empty image
    // content renders as it will be sealed, i.e. as nothing.
    const isPlaceholderVisible = !image && isContentEditorGuidesVisible(options);

    placeholderRect.setAttrs({
      visible: isPlaceholderVisible,
      x: 0,
      y: 0,
      width: geometry.width,
      height: geometry.height,
      stroke: KONVA_CONTENT_GUIDE_STROKE_COLOR,
      strokeWidth: KONVA_CONTENT_GUIDE_STROKE_WIDTH,
    } satisfies Partial<Konva.RectConfig>);

    placeholderText.setAttrs({
      visible: isPlaceholderVisible,
      x: 0,
      y: 0,
      width: geometry.width,
      height: geometry.height,
      text: translations?.[meta.type] || 'Image',
      fontSize: DEFAULT_CONTENT_FONT_SIZE,
      fontFamily: konvaTextFontFamily,
      fill: KONVA_CONTENT_PLACEHOLDER_TEXT_COLOR,
    } satisfies Partial<Konva.TextConfig>);
  });
};
