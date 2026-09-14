import Konva from 'konva';

import type { TContentLineMeta } from '../../types/envelope-content-meta';
import { DEFAULT_CONTENT_STROKE_COLOR } from '../../types/envelope-content-meta';
import {
  createLineContentHoverInteraction,
  upsertContentGroup,
  upsertContentGroupChild,
} from './content-generic-items';
import type { ContentToRender, RenderContentOptions } from './content-renderer';
import {
  CONTENT_DEFAULT_STROKE_WIDTH,
  CONTENT_LINE_HIT_STROKE_WIDTH,
  CONTENT_LINE_NODE_NAME,
  calculateContentLineGeometry,
  resolveContentStrokeDash,
} from './content-renderer';

export const renderLineContentElement = (
  content: ContentToRender,
  meta: TContentLineMeta,
  options: RenderContentOptions,
): Konva.Group => {
  const { pageWidth, pageHeight } = options;

  const geometry = calculateContentLineGeometry(meta, pageWidth, pageHeight);

  const contentGroup = upsertContentGroup(content, options, geometry);

  const contentLine = upsertContentGroupChild<Konva.Line>(
    contentGroup,
    `${content.renderId}-line`,
    () =>
      new Konva.Line({
        name: CONTENT_LINE_NODE_NAME,
      }),
  );

  const strokeWidth = meta.strokeWidth ?? CONTENT_DEFAULT_STROKE_WIDTH;
  const strokeStyle = meta.strokeStyle ?? 'solid';

  contentLine.setAttrs({
    points: geometry.points,
    stroke: meta.strokeColor ?? DEFAULT_CONTENT_STROKE_COLOR,
    // Stroke width is in unscaled page units, so it scales with the page like
    // the rest of the document content.
    strokeWidth,
    dash: resolveContentStrokeDash(strokeStyle, strokeWidth),
    // Round caps read well for solid/dashed lines, but would merge dots
    // together for dotted lines.
    lineCap: strokeStyle === 'dotted' ? 'butt' : 'round',
    hitStrokeWidth: Math.max(CONTENT_LINE_HIT_STROKE_WIDTH, strokeWidth),
  } satisfies Partial<Konva.LineConfig>);

  createLineContentHoverInteraction(contentGroup, content, options, geometry.points, strokeWidth);

  return contentGroup;
};
