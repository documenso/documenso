import Konva from 'konva';
import { match } from 'ts-pattern';

import type { TContentShapeMeta } from '../../types/envelope-content-meta';
import { ContentShapeType, DEFAULT_CONTENT_STROKE_COLOR } from '../../types/envelope-content-meta';
import { createContentHoverInteraction, upsertContentGroup, upsertContentGroupChild } from './content-generic-items';
import type { ContentToRender, RenderContentOptions } from './content-renderer';
import {
  CONTENT_BOUNDS_NODE_NAME,
  CONTENT_DEFAULT_STROKE_WIDTH,
  CONTENT_TRANSPARENT_FILL,
  calculateContentBoxGeometry,
  hexToRgba,
  resolveContentStrokeDash,
} from './content-renderer';

type ShapeGeometry = ReturnType<typeof calculateContentBoxGeometry>;

/**
 * The stroke and fill shared by every shape.
 *
 * Konva has no fill-only opacity, so the opacity is baked into the fill color
 * alpha to keep the stroke fully opaque. A transparent fill is used when there
 * is no fill color so the inner area is still part of the hit region.
 */
const resolveShapeStyle = (meta: TContentShapeMeta) => {
  const strokeWidth = meta.strokeWidth ?? CONTENT_DEFAULT_STROKE_WIDTH;
  const strokeStyle = meta.strokeStyle ?? 'solid';

  return {
    stroke: meta.strokeColor ?? DEFAULT_CONTENT_STROKE_COLOR,
    strokeWidth,
    dash: resolveContentStrokeDash(strokeStyle, strokeWidth),
    fill: meta.fillColor ? hexToRgba(meta.fillColor, meta.fillOpacity ?? 1) : CONTENT_TRANSPARENT_FILL,
  } satisfies Partial<Konva.ShapeConfig>;
};

/**
 * Render a shape content, dispatching on its `shape`.
 *
 * Each shape upserts its own node tagged as the content bounds so selection
 * and resizing work uniformly.
 */
export const renderShapeContentElement = (
  content: ContentToRender,
  meta: TContentShapeMeta,
  options: RenderContentOptions,
): Konva.Group => {
  const { pageWidth, pageHeight } = options;

  const geometry = calculateContentBoxGeometry(meta, pageWidth, pageHeight);

  const contentGroup = upsertContentGroup(content, options, {
    ...geometry,
    rotation: meta.rotation ?? 0,
  });

  // A shape's node type differs per shape, so swap the node out if the shape
  // changed since the last render.
  if (contentGroup.getAttr('contentShape') !== meta.shape) {
    contentGroup.findOne(`#${content.renderId}-shape`)?.destroy();
    contentGroup.setAttr('contentShape', meta.shape);
  }

  match(meta.shape)
    .with(ContentShapeType.RECTANGLE, () => renderRectangleShape(contentGroup, content, meta, geometry))
    .exhaustive();

  createContentHoverInteraction(contentGroup, content, options, geometry.width, geometry.height);

  return contentGroup;
};

const renderRectangleShape = (
  contentGroup: Konva.Group,
  content: ContentToRender,
  meta: TContentShapeMeta,
  geometry: ShapeGeometry,
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
