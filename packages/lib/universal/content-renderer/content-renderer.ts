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

/**
 * The stroke of the editor-only guides: the dashed bounds around a text
 * content and the placeholder box of an image content without an image.
 * Only drawn when `isContentEditorGuidesVisible` is true.
 */
export const KONVA_CONTENT_GUIDE_STROKE_WIDTH = 1;
export const KONVA_CONTENT_GUIDE_STROKE_COLOR = '#9ca3af';

/**
 * The label inside an image content's placeholder box.
 */
export const KONVA_CONTENT_PLACEHOLDER_TEXT_COLOR = '#6b7280';

/**
 * The outline shown while hovering an editable content.
 */
export const KONVA_CONTENT_HOVER_OUTLINE_COLOR = KONVA_SELECTION_OUTLINE_COLOR;

/**
 * Convert a hex color (`#rgb` or `#rrggbb`) to an `rgb()`/`rgba()` string
 * with the given alpha, for a Konva fill which needs to be translucent
 * independently of its stroke.
 */
export const hexToRgba = (hex: string, alpha: number) => {
  return colord(hex)
    .alpha(clamp(alpha, { min: 0, max: 1 }))
    .toRgbString();
};

/**
 * Resolve the Konva dash pattern for a stroke style, scaled by the stroke
 * width so the pattern stays proportional.
 */
export const resolveContentStrokeDash = (strokeStyle: TContentStrokeStyle, strokeWidth: number): number[] => {
  return match(strokeStyle)
    .with('solid', () => [])
    .with('dashed', () => [strokeWidth * 4, strokeWidth * 3])
    .with('dotted', () => [strokeWidth, strokeWidth * 2])
    .exhaustive();
};

type ContentStrokeMeta = Pick<TContentLineMeta, 'strokeWidth' | 'strokeColor' | 'strokeStyle'>;

/**
 * The Konva stroke attributes of a line or shape content.
 */
export const resolveContentStroke = ({ strokeWidth, strokeColor, strokeStyle }: ContentStrokeMeta) => ({
  stroke: strokeColor,
  strokeWidth,
  strokeStyle,
  dash: resolveContentStrokeDash(strokeStyle, strokeWidth),
});

/**
 * Narrow a content meta to the given type, throwing if a renderer was handed
 * the wrong content.
 */
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
 * The smallest box, in unscaled page units, which counts as deliberately
 * drawn when creating a content by dragging on the page.
 *
 * Matches the field equivalents so both feel the same to draw.
 */
export const MIN_CONTENT_HEIGHT_PX = 6;
export const MIN_CONTENT_WIDTH_PX = 18;

/**
 * The Konva group name shared by all rendered contents.
 */
export const CONTENT_GROUP_NODE_NAME = 'content-group';

/**
 * A secondary Konva name applied to the child node which represents the
 * unscaled box bounds of a box content (Konva names are space separated).
 *
 * Each box renderer tags its own bounds node, so consumers can resolve the
 * bounds without knowing renderer internals.
 */
export const CONTENT_BOUNDS_NODE_NAME = 'content-bounds';

/**
 * The Konva name of the line node within a line content group.
 */
export const CONTENT_LINE_NODE_NAME = 'content-line';

export type ContentToRender = {
  /**
   * A unique ID for the content in the render.
   */
  renderId: string;

  contentMeta: TEnvelopeContentMeta;

  /**
   * The ID of the data content (e.g. an uploaded image) attached to the
   * content, used to look up its loaded image in `RenderContentOptions.images`.
   */
  dataContentId?: string | null;
};

/**
 * A decoded image which Konva can draw.
 *
 * In the browser this is an `HTMLImageElement` or `ImageBitmap`. On the server
 * it is a skia-canvas `Image`, which has the same `width`/`height` surface and
 * is passed as an `HTMLImageElement`.
 */
export type ContentImageSource = HTMLImageElement | ImageBitmap;

/**
 * The loaded images for image contents, keyed by data content ID.
 *
 * Rendering is synchronous, so callers load the images of the contents they
 * render ahead of time.
 */
export type ContentImageMap = ReadonlyMap<string, ContentImageSource>;

export type RenderContentOptions = {
  pageLayer: Konva.Layer;

  /**
   * The unscaled page width in pixels.
   */
  pageWidth: number;

  /**
   * The unscaled page height in pixels.
   */
  pageHeight: number;

  /**
   * The scale of the stage the content is rendered on.
   *
   * Required to keep dragged contents within the page bounds, since drag
   * positions are in scaled stage coordinates.
   */
  scale: number;

  mode: FieldRenderMode;

  /**
   * Whether the content group should be draggable.
   */
  editable?: boolean;

  /**
   * Translated names for each content type, used for placeholder labels.
   */
  translations?: Record<EnvelopeContentType, string> | null;

  /**
   * The stroke color of the outline shown while hovering an editable content.
   * Defaults to `KONVA_CONTENT_HOVER_OUTLINE_COLOR`.
   */
  hoverOutlineColor?: string;

  /**
   * The loaded images for the image contents being rendered.
   *
   * Image contents whose image is absent render a placeholder, except when
   * exporting where a missing image is an error.
   */
  images?: ContentImageMap;
};

/**
 * Whether editor guides (dashed bounds, placeholders for empty images) should
 * be drawn.
 *
 * Contents are part of the document, so everywhere except the content editor
 * itself (the editor's fields tab, previews, signing, export) they render
 * exactly as they will be sealed.
 */
export const isContentEditorGuidesVisible = ({ mode, editable }: Pick<RenderContentOptions, 'mode' | 'editable'>) => {
  return mode === 'edit' && editable === true;
};

/**
 * Fit an image within a box while preserving its aspect ratio, centering it
 * along the axis it does not fill (CSS `object-fit: contain`).
 *
 * Small images are enlarged to fill the box, since the box is the author's
 * intended size.
 */
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

/**
 * Convert the percentage based box geometry of a content meta to pixels.
 */
export const calculateContentBoxGeometry = (meta: BoxContentMeta, pageWidth: number, pageHeight: number): Rect => {
  return toPixelRect(meta, { width: pageWidth, height: pageHeight });
};

export type LineContentMeta = Pick<TContentLineMeta, 'x1' | 'y1' | 'x2' | 'y2'>;

/**
 * Convert the percentage based line geometry of a content meta to a pixel
 * based group position (the top left of the line bounds) and line points
 * relative to it, so dragging the group moves the whole line.
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
