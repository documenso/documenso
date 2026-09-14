import Konva from 'konva';

import type { TContentHighlightMeta } from '../../types/envelope-content-meta';
import { DEFAULT_CONTENT_HIGHLIGHT_COLOR, DEFAULT_CONTENT_HIGHLIGHT_OPACITY } from '../../types/envelope-content-meta';
import { createContentHoverInteraction, upsertContentGroup, upsertContentGroupChild } from './content-generic-items';
import type { ContentToRender, RenderContentOptions } from './content-renderer';
import { CONTENT_BOUNDS_NODE_NAME, calculateContentBoxGeometry, hexToRgba } from './content-renderer';

export const renderHighlightContentElement = (
  content: ContentToRender,
  meta: TContentHighlightMeta,
  options: RenderContentOptions,
): Konva.Group => {
  const { pageWidth, pageHeight } = options;

  const geometry = calculateContentBoxGeometry(meta, pageWidth, pageHeight);

  const contentGroup = upsertContentGroup(content, options, {
    ...geometry,
    rotation: meta.rotation ?? 0,
  });

  const contentHighlight = upsertContentGroupChild(
    contentGroup,
    `${content.renderId}-highlight`,
    () =>
      new Konva.Rect({
        name: `content-highlight ${CONTENT_BOUNDS_NODE_NAME}`,
      }),
  );

  contentHighlight.setAttrs({
    x: 0,
    y: 0,
    width: geometry.width,
    height: geometry.height,
    fill: hexToRgba(meta.color ?? DEFAULT_CONTENT_HIGHLIGHT_COLOR, meta.opacity ?? DEFAULT_CONTENT_HIGHLIGHT_OPACITY),
  } satisfies Partial<Konva.RectConfig>);

  createContentHoverInteraction(contentGroup, content, options, geometry.width, geometry.height);

  return contentGroup;
};
