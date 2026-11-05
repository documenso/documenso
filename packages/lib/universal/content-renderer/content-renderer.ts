import { colord } from 'colord';
import type Konva from 'konva';
import { clamp } from 'remeda';
import { match } from 'ts-pattern';

import { AppError } from '../../errors/app-error';
import type {
  EnvelopeContentType,
  TContentLineMeta,
  TContentStrokeStyle,
  TEnvelopeContentMeta,
} from '../../types/envelope-content-meta';
import type { PercentageBox, Rect, Size } from '../../utils/geometry';
import { toPixelRect, toPixels } from '../../utils/geometry';
import type { FieldRenderMode } from '../field-renderer/field-renderer';
import { KONVA_SELECTION_OUTLINE_COLOR } from '../konva/constants';

/**
 * Konva presentation constants for contents.
 *
 * These only affect how contents are painted on the canvas and are never
 * persisted. Not to be confused with the `DEFAULT_CONTENT_*` values in
 * `envelope-content-meta.ts`, which seed a content's stored metadata.
 */

export const KONVA_CONTENT_GUIDE_STROKE_WIDTH = 1;
export const KONVA_CONTENT_GUIDE_STROKE_COLOR = '#9ca3af';

export const KONVA_CONTENT_PLACEHOLDER_TEXT_COLOR = '#6b7280';

export const KONVA_CONTENT_HOVER_OUTLINE_COLOR = KONVA_SELECTION_OUTLINE_COLOR;

export const hexToRgba = (hex: string, alpha: number) => {
  return colord(hex)
    .alpha(clamp(alpha, { min: 0, max: 1 }))
    .toRgbString();
};

export const resolveContentStrokeDash = (strokeStyle: TContentStrokeStyle, strokeWidth: number): number[] => {
  return match(strokeStyle)
    .with('solid', () => [])
    .with('dashed', () => [strokeWidth * 4, strokeWidth * 3])
    .with('dotted', () => [strokeWidth, strokeWidth * 2])
    .exhaustive();
};

type ContentStrokeMeta = Pick<TContentLineMeta, 'strokeWidth' | 'strokeColor' | 'strokeStyle'>;

export const resolveContentStroke = ({ strokeWidth, strokeColor, strokeStyle }: ContentStrokeMeta) => ({
  stroke: strokeColor,
  strokeWidth,
  strokeStyle,
  dash: resolveContentStrokeDash(strokeStyle, strokeWidth),
});

export const assertContentMetaType = <TType extends EnvelopeContentType>(
  meta: TEnvelopeContentMeta,
  type: TType,
): Extract<TEnvelopeContentMeta, { type: TType }> => {
  if (meta.type !== type) {
    throw new AppError('INVALID_CONTENT_TYPE', {
      message: `Expected content type ${type} but got ${meta.type}`,
    });
  }

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return meta as Extract<TEnvelopeContentMeta, { type: TType }>;
};

/**
 * The larger invisible stroke around lines so they are easier to click.
 */
export const KONVA_CONTENT_LINE_HIT_STROKE_WIDTH = 12;

/**
 * Matches the field equivalents so both feel the same to draw.
 */
export const MIN_CONTENT_HEIGHT_PX = 6;
export const MIN_CONTENT_WIDTH_PX = 18;

export const CONTENT_GROUP_NODE_NAME = 'content-group';

/**
 * Each box renderer tags its own bounds node with this secondary name, so
 * consumers can resolve the bounds without knowing renderer internals.
 */
export const CONTENT_BOUNDS_NODE_NAME = 'content-bounds';

export const CONTENT_LINE_NODE_NAME = 'content-line';

export type ContentToRender = {
  renderId: string;

  contentMeta: TEnvelopeContentMeta;

  dataContentId?: string | null;
};

/**
 * On the server this is a skia-canvas `Image`, which has the same
 * `width`/`height` surface and is passed as an `HTMLImageElement`.
 */
export type ContentImageSource = HTMLImageElement | ImageBitmap;

export type ContentImageMap = ReadonlyMap<string, ContentImageSource>;

export type RenderContentOptions = {
  pageLayer: Konva.Layer;

  pageWidth: number;

  pageHeight: number;

  /**
   * Required to keep dragged contents within the page bounds, since drag
   * positions are in scaled stage coordinates.
   */
  scale: number;

  mode: FieldRenderMode;

  editable?: boolean;

  translations?: Record<EnvelopeContentType, string> | null;

  hoverOutlineColor?: string;

  images?: ContentImageMap;
};

/**
 * Contents are part of the document, so everywhere except the content editor
 * itself (the editor's fields tab, previews, signing, export) they render
 * exactly as they will be sealed.
 */
export const isContentEditorGuidesVisible = ({ mode, editable }: Pick<RenderContentOptions, 'mode' | 'editable'>) => {
  return mode === 'edit' && editable === true;
};

export const calculateContainFit = (image: Size, box: Size): Rect => {
  if (image.width <= 0 || image.height <= 0 || box.width <= 0 || box.height <= 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  const scale = Math.min(box.width / image.width, box.height / image.height);

  const width = image.width * scale;
  const height = image.height * scale;

  return {
    x: (box.width - width) / 2,
    y: (box.height - height) / 2,
    width,
    height,
  };
};

export type BoxContentMeta = PercentageBox;

export const calculateContentBoxGeometry = (meta: BoxContentMeta, pageWidth: number, pageHeight: number): Rect => {
  return toPixelRect(meta, { width: pageWidth, height: pageHeight });
};

export type LineContentMeta = Pick<TContentLineMeta, 'x1' | 'y1' | 'x2' | 'y2'>;

/**
 * The group sits at the top left of the line bounds with the points relative
 * to it, so dragging the group moves the whole line.
 */
export const calculateContentLineGeometry = (meta: LineContentMeta, pageWidth: number, pageHeight: number) => {
  const startX = toPixels(meta.x1, pageWidth);
  const endX = toPixels(meta.x2, pageWidth);
  const startY = toPixels(meta.y1, pageHeight);
  const endY = toPixels(meta.y2, pageHeight);

  const x = Math.min(startX, endX);
  const y = Math.min(startY, endY);

  return {
    x,
    y,
    points: [startX - x, startY - y, endX - x, endY - y],
  };
};
