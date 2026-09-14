import type Konva from 'konva';
import { match } from 'ts-pattern';

import type {
  EnvelopeContentType,
  TContentLineMeta,
  TContentShapeMeta,
  TContentStrokeStyle,
  TEnvelopeContentMetaOutput,
} from '../../types/envelope-content-meta';
import type { FieldRenderMode } from '../field-renderer/field-renderer';

export const CONTENT_DEFAULT_STROKE_WIDTH = 1;
export const CONTENT_PLACEHOLDER_STROKE_COLOR = '#9ca3af';
export const CONTENT_PLACEHOLDER_TEXT_COLOR = '#6b7280';
export const CONTENT_HOVER_OUTLINE_COLOR = 'rgba(24, 160, 251, 0.8)';

/**
 * A fully transparent fill. Konva hit detection ignores alpha, so this keeps
 * the filled area clickable while painting nothing.
 */
export const CONTENT_TRANSPARENT_FILL = 'rgba(0, 0, 0, 0)';

/**
 * Convert a hex color (`#rgb` or `#rrggbb`) to an `rgba()` string with the
 * given alpha.
 */
export const hexToRgba = (hex: string, alpha: number) => {
  let normalized = hex.replace('#', '');

  if (normalized.length === 3) {
    normalized = normalized
      .split('')
      .map((char) => char + char)
      .join('');
  }

  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);

  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
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

/**
 * The larger invisible stroke around lines so they are easier to click.
 */
export const CONTENT_LINE_HIT_STROKE_WIDTH = 12;

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

  contentMeta: TEnvelopeContentMetaOutput;

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
   * Defaults to `CONTENT_HOVER_OUTLINE_COLOR`.
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

type Size = {
  width: number;
  height: number;
};

/**
 * Fit an image within a box while preserving its aspect ratio, centering it
 * along the axis it does not fill (CSS `object-fit: contain`).
 *
 * Small images are enlarged to fill the box, since the box is the author's
 * intended size.
 */
export const calculateContainFit = (image: Size, box: Size) => {
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

export type BoxContentMeta = Pick<TContentShapeMeta, 'positionX' | 'positionY' | 'width' | 'height'>;

/**
 * Convert the percentage based box geometry of a content meta to pixels.
 */
export const calculateContentBoxGeometry = (meta: BoxContentMeta, pageWidth: number, pageHeight: number) => {
  return {
    x: pageWidth * ((meta.positionX ?? 0) / 100),
    y: pageHeight * ((meta.positionY ?? 0) / 100),
    width: pageWidth * ((meta.width ?? 0) / 100),
    height: pageHeight * ((meta.height ?? 0) / 100),
  };
};

export type LineContentMeta = Pick<
  TContentLineMeta,
  'startXPosition' | 'endXPosition' | 'startYPosition' | 'endYPosition'
>;

/**
 * Convert the percentage based line geometry of a content meta to a pixel
 * based group position (the top left of the line bounds) and line points
 * relative to it, so dragging the group moves the whole line.
 */
export const calculateContentLineGeometry = (meta: LineContentMeta, pageWidth: number, pageHeight: number) => {
  const startX = pageWidth * ((meta.startXPosition ?? 0) / 100);
  const endX = pageWidth * ((meta.endXPosition ?? 0) / 100);
  const startY = pageHeight * ((meta.startYPosition ?? 0) / 100);
  const endY = pageHeight * ((meta.endYPosition ?? 0) / 100);

  const x = Math.min(startX, endX);
  const y = Math.min(startY, endY);

  return {
    x,
    y,
    points: [startX - x, startY - y, endX - x, endY - y],
  };
};
