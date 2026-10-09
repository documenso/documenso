import Konva from 'konva';

import { EnvelopeContentType } from '../../types/envelope-content-meta';
import { renderBoxContent, upsertContentGroupChild } from './content-generic-items';
import type { ContentToRender, RenderContentOptions } from './content-renderer';
import { assertContentMetaType, CONTENT_BOUNDS_NODE_NAME, hexToRgba } from './content-renderer';

export const renderHighlightContentElement = (content: ContentToRender, options: RenderContentOptions): Konva.Group => {
  return renderBoxContent(content, options, ({ contentGroup, meta: boxMeta, geometry }) => {
    const meta = assertContentMetaType(boxMeta, EnvelopeContentType.HIGHLIGHT);

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
      fill: hexToRgba(meta.color, meta.fillOpacity),
    } satisfies Partial<Konva.RectConfig>);
  });
};
