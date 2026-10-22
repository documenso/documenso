import Konva from 'konva';
import { match } from 'ts-pattern';

import type { TContentShapeMeta } from '../../types/envelope-content-meta';
import { EnvelopeContentShapeType, EnvelopeContentType } from '../../types/envelope-content-meta';
import type { Rect } from '../../utils/geometry';
import { KONVA_TRANSPARENT_FILL } from '../konva/constants';
import { renderBoxContent, upsertContentGroupChild } from './content-generic-items';
import type { ContentToRender, RenderContentOptions } from './content-renderer';
import { assertContentMetaType, CONTENT_BOUNDS_NODE_NAME, hexToRgba, resolveContentStroke } from './content-renderer';

/**
 * The stroke and fill shared by every shape.
 *
 * Konva has no fill-only opacity, so the opacity is baked into the fill color
 * alpha to keep the stroke fully opaque. A transparent fill is used when there
 * is no fill color so the inner area is still part of the hit region.
 */
const resolveShapeStyle = (meta: TContentShapeMeta) => {
  const { stroke, strokeWidth, dash } = resolveContentStroke(meta);

  return {
    stroke,
    strokeWidth,
    dash,
    fill: meta.fillColor ? hexToRgba(meta.fillColor, meta.fillOpacity) : KONVA_TRANSPARENT_FILL,
  } satisfies Partial<Konva.ShapeConfig>;
};

/**
 * Render a shape content, dispatching on its `shape`.
 *
 * Each shape upserts its own node tagged as the content bounds so selection
 * and resizing work uniformly.
 */
export const renderShapeContentElement = (content: ContentToRender, options: RenderContentOptions): Konva.Group => {
  return renderBoxContent(content, options, ({ contentGroup, meta: boxMeta, geometry }) => {
    const meta = assertContentMetaType(boxMeta, EnvelopeContentType.SHAPE);

    // A shape's node type differs per shape, so swap the node out if the shape
    // changed since the last render.
    if (contentGroup.getAttr('contentShape') !== meta.shape) {
      contentGroup.findOne(`#${content.renderId}-shape`)?.destroy();
      contentGroup.setAttr('contentShape', meta.shape);
    }

    match(meta.shape)
      .with(EnvelopeContentShapeType.RECTANGLE, () => renderRectangleShape(contentGroup, content, meta, geometry))
      .exhaustive();
  });
};

const renderRectangleShape = (
  contentGroup: Konva.Group,
  content: ContentToRender,
  meta: TContentShapeMeta,
  geometry: Rect,
) => {
  const rect = upsertContentGroupChild(
    contentGroup,
    `${content.renderId}-shape`,
    () =>
      new Konva.Rect({
        name: `content-shape ${CONTENT_BOUNDS_NODE_NAME}`,
      }),
  );

  rect.setAttrs({
    x: 0,
    y: 0,
    width: geometry.width,
    height: geometry.height,
    ...resolveShapeStyle(meta),
  } satisfies Partial<Konva.RectConfig>);
};
