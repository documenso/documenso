import Konva from 'konva';

import { EnvelopeContentType } from '../../types/envelope-content-meta';
import {
  createLineContentHoverInteraction,
  upsertContentGroup,
  upsertContentGroupChild,
} from './content-generic-items';
import type { ContentToRender, RenderContentOptions } from './content-renderer';
import {
  assertContentMetaType,
  CONTENT_LINE_NODE_NAME,
  calculateContentLineGeometry,
  KONVA_CONTENT_LINE_HIT_STROKE_WIDTH,
  resolveContentStroke,
} from './content-renderer';

export const renderLineContentElement = (content: ContentToRender, options: RenderContentOptions): Konva.Group => {
  const { pageWidth, pageHeight } = options;

  const meta = assertContentMetaType(content.contentMeta, EnvelopeContentType.LINE);

  const geometry = calculateContentLineGeometry(meta, pageWidth, pageHeight);

  // A line is drawn from its own points, so the group itself never rotates.
  const contentGroup = upsertContentGroup(content, options, { x: geometry.x, y: geometry.y, rotation: 0 });

  const contentLine = upsertContentGroupChild<Konva.Line>(
    contentGroup,
    `${content.renderId}-line`,
    () =>
      new Konva.Line({
        name: CONTENT_LINE_NODE_NAME,
      }),
  );

  const { stroke, strokeWidth, strokeStyle, dash } = resolveContentStroke(meta);

  contentLine.setAttrs({
    points: geometry.points,
    stroke,
    // Stroke width is in unscaled page units, so it scales with the page like
    // the rest of the document content.
    strokeWidth,
    dash,
    // Round caps read well for solid/dashed lines, but would merge dots
    // together for dotted lines.
    lineCap: strokeStyle === 'dotted' ? 'butt' : 'round',
    hitStrokeWidth: Math.max(KONVA_CONTENT_LINE_HIT_STROKE_WIDTH, strokeWidth),
  } satisfies Partial<Konva.LineConfig>);

  createLineContentHoverInteraction(contentGroup, content, options, geometry.points, strokeWidth);

  return contentGroup;
};
