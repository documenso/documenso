import { z } from 'zod';
import { DataContentType } from './data-content-meta';
import { ZFieldPageNumberSchema } from './field';
import {
  FIELD_DEFAULT_GENERIC_ALIGN,
  FIELD_DEFAULT_GENERIC_VERTICAL_ALIGN,
  FIELD_DEFAULT_LETTER_SPACING,
  FIELD_DEFAULT_LINE_HEIGHT,
  ZFieldMetaLetterSpacing,
  ZFieldMetaLineHeight,
  ZFieldMetaVerticalAlign,
  ZFieldTextAlignSchema,
} from './field-meta';

// Note: This is different to field content.
// Todo: Content decide on this.
export const DEFAULT_CONTENT_FONT_SIZE = 10;

/**
 * Generic content schemas.
 */

export const ZFromZeroToOnehundredSchema = z.number().min(0).max(100);

/**
 * Rotation in degrees, clockwise, normalized to [0, 360).
 *
 * The content rotates about its top left corner (`positionX`, `positionY`),
 * which stays fixed while the rest of the box sweeps around it. The editor's
 * transformer works the same way. API callers rotating a content should
 * adjust `positionX`/`positionY` as needed to keep the swept box where they
 * want it and within the page.
 */
export const ZContentRotationSchema = z
  .number()
  .min(0)
  .lt(360)
  .describe('Rotation in degrees, clockwise, about the top left corner of the content.');

/**
 * Normalize any rotation in degrees to the [0, 360) range.
 */
export const normalizeContentRotation = (rotation: number) => {
  // Adding 360 before the second modulo handles negatives, and the `+ 0`
  // converts a potential `-0` (e.g. from `-360 % 360`) into `+0`.
  return (((rotation % 360) + 360) % 360) + 0;
};

/**
 * A hex color (`#rgb` or `#rrggbb`).
 *
 * Kept strict since colors are drawn directly onto the canvas and PDF.
 */
export const ZContentColorSchema = z
  .string()
  .regex(/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i, 'Must be a valid hex color')
  .describe('A hex color');

export const DEFAULT_CONTENT_TEXT_COLOR = '#000000';
export const DEFAULT_CONTENT_STROKE_COLOR = '#000000';
export const DEFAULT_CONTENT_HIGHLIGHT_COLOR = '#ffe600';

/**
 * Opacity as a fraction between 0 (transparent) and 1 (opaque).
 */
export const ZContentOpacitySchema = z.number().min(0).max(1);

/**
 * Stroke width in unscaled page units.
 */
export const CONTENT_MIN_STROKE_WIDTH = 0.5;
export const CONTENT_MAX_STROKE_WIDTH = 20;

/**
 * The highest stacking order a content may be given.
 *
 * Well below the int4 ceiling of the column so that placing a content above
 * everything else on its page (the highest plus one) always fits.
 */
export const CONTENT_MAX_Z_INDEX = 1_000_000;

export const ZContentZIndexSchema = z.number().int().min(0).max(CONTENT_MAX_Z_INDEX);

export const ZContentStrokeWidthSchema = z.number().min(CONTENT_MIN_STROKE_WIDTH).max(CONTENT_MAX_STROKE_WIDTH);

export const ZContentStrokeStyleSchema = z.enum(['solid', 'dashed', 'dotted']);
export type TContentStrokeStyle = z.infer<typeof ZContentStrokeStyleSchema>;

export enum EnvelopeContentType {
  TEXT = 'text',
  LINE = 'line',
  SHAPE = 'shape',
  HIGHLIGHT = 'highlight',
  IMAGE = 'image',
  // Todo: Contents - Add in next iteration
  // STAMP = 'stamp',
}

/**
 * The kinds of shape a shape content can be.
 */
export enum ContentShapeType {
  RECTANGLE = 'rectangle',
}

export const ZContentShapeTypeSchema = z.nativeEnum(ContentShapeType);

export const EnvelopeContentTypeSchema = z.nativeEnum(EnvelopeContentType);

/**
 * The content types which can currently be rotated, both via the canvas and
 * the settings form.
 *
 * Todo: Content - Expand once rotation is supported for the remaining types.
 */
export const ROTATABLE_CONTENT_TYPES: ReadonlySet<EnvelopeContentType> = new Set([
  EnvelopeContentType.IMAGE,
  // EnvelopeContentType.STAMP,
  EnvelopeContentType.SHAPE,
]);

export const isContentTypeRotatable = (type: EnvelopeContentType) => ROTATABLE_CONTENT_TYPES.has(type);
export type TEnvelopeContent = z.infer<typeof EnvelopeContentTypeSchema>;

/**
 * The kind of data content each content type can be linked to, e.g. an
 * uploaded image. Content types not listed cannot hold data.
 */
export const CONTENT_TYPE_DATA_CONTENT_KIND: Partial<Record<EnvelopeContentType, DataContentType>> = {
  [EnvelopeContentType.IMAGE]: DataContentType.IMAGE,
};

/**
 * Generic positional data for specific content types.
 */
export const ZBasePositionalContentMeta = z.object({
  // Todo: Content standardize this with v2 API
  height: ZFromZeroToOnehundredSchema.optional(),
  width: ZFromZeroToOnehundredSchema.optional(),
  page: ZFieldPageNumberSchema.int().optional(),
  positionX: ZFromZeroToOnehundredSchema.optional(),
  positionY: ZFromZeroToOnehundredSchema.optional(),
});

// TEXT CONTENT

export const ZContentTextMeta = ZBasePositionalContentMeta.extend({
  rotation: ZContentRotationSchema.optional().default(0),
  type: z.literal(EnvelopeContentType.TEXT),
  text: z.string().optional(),
  textAlign: ZFieldTextAlignSchema.optional(),
  verticalAlign: ZFieldMetaVerticalAlign.nullish(),
  lineHeight: ZFieldMetaLineHeight.nullish(),
  letterSpacing: ZFieldMetaLetterSpacing.nullish(),
  fontSize: z.number().min(8).max(96).optional(),

  /**
   * The text color. Defaults to black when undefined.
   */
  color: ZContentColorSchema.optional(),
});

export type TContentTextMeta = z.infer<typeof ZContentTextMeta>;

export const DEFAULT_CONTENT_TEXT = 'Text';

export const CONTENT_TEXT_META_DEFAULT_VALUES: TContentTextMeta = {
  type: EnvelopeContentType.TEXT,
  rotation: 0,
  text: DEFAULT_CONTENT_TEXT,
  textAlign: FIELD_DEFAULT_GENERIC_ALIGN,
  verticalAlign: FIELD_DEFAULT_GENERIC_VERTICAL_ALIGN,
  lineHeight: FIELD_DEFAULT_LINE_HEIGHT,
  letterSpacing: FIELD_DEFAULT_LETTER_SPACING,
  fontSize: DEFAULT_CONTENT_FONT_SIZE,
  color: DEFAULT_CONTENT_TEXT_COLOR,
};

// LINE CONTENT

export const ZContentLineMeta = ZBasePositionalContentMeta.pick({
  page: true,
}).extend({
  // Todo: Content use better names
  startXPosition: ZFromZeroToOnehundredSchema.optional(),
  endXPosition: ZFromZeroToOnehundredSchema.optional(),

  startYPosition: ZFromZeroToOnehundredSchema.optional(),
  endYPosition: ZFromZeroToOnehundredSchema.optional(),

  type: z.literal(EnvelopeContentType.LINE),

  strokeWidth: ZContentStrokeWidthSchema.optional(),
  strokeColor: ZContentColorSchema.optional(),
  strokeStyle: ZContentStrokeStyleSchema.optional(),
});

export type TContentLineMeta = z.infer<typeof ZContentLineMeta>;

export const CONTENT_LINE_META_DEFAULT_VALUES: TContentLineMeta = {
  type: EnvelopeContentType.LINE,
  startXPosition: 0,
  endXPosition: 100,
  startYPosition: 0,
  endYPosition: 100,
  strokeWidth: 1,
  strokeColor: DEFAULT_CONTENT_STROKE_COLOR,
  strokeStyle: 'solid',
};

// SHAPE CONTENT

/**
 * A shape within a box, discriminated by `shape`.
 *
 * Every shape currently shares the same stroke and fill settings, so this is a
 * single schema. Turn it into a `discriminatedUnion('shape', ...)` once a
 * shape needs its own fields.
 */
export const ZContentShapeMeta = ZBasePositionalContentMeta.extend({
  rotation: ZContentRotationSchema.optional().default(0),
  type: z.literal(EnvelopeContentType.SHAPE),
  shape: ZContentShapeTypeSchema,

  strokeWidth: ZContentStrokeWidthSchema.optional(),
  strokeColor: ZContentColorSchema.optional(),
  strokeStyle: ZContentStrokeStyleSchema.optional(),

  /**
   * The fill color. No fill when undefined.
   */
  fillColor: ZContentColorSchema.optional(),
  fillOpacity: ZContentOpacitySchema.optional(),
});

export type TContentShapeMeta = z.infer<typeof ZContentShapeMeta>;

export const CONTENT_RECTANGLE_META_DEFAULT_VALUES: TContentShapeMeta = {
  type: EnvelopeContentType.SHAPE,
  shape: ContentShapeType.RECTANGLE,
  rotation: 0,
  height: 1,
  width: 1,
  page: 1,
  positionX: 0,
  positionY: 0,
  strokeWidth: 1,
  strokeColor: DEFAULT_CONTENT_STROKE_COLOR,
  strokeStyle: 'solid',
  fillOpacity: 1,
};

/**
 * The default meta per shape, for when a shape is placed from the palette.
 */
export const CONTENT_SHAPE_META_DEFAULT_VALUES: Record<ContentShapeType, TContentShapeMeta> = {
  [ContentShapeType.RECTANGLE]: CONTENT_RECTANGLE_META_DEFAULT_VALUES,
};

// HIGHLIGHT CONTENT

export const ZContentHighlightMeta = ZBasePositionalContentMeta.extend({
  rotation: ZContentRotationSchema.optional().default(0),
  type: z.literal(EnvelopeContentType.HIGHLIGHT),

  color: ZContentColorSchema.optional(),
  opacity: ZContentOpacitySchema.optional(),
});

export type TContentHighlightMeta = z.infer<typeof ZContentHighlightMeta>;

export const DEFAULT_CONTENT_HIGHLIGHT_OPACITY = 0.4;

export const CONTENT_HIGHLIGHT_META_DEFAULT_VALUES: TContentHighlightMeta = {
  type: EnvelopeContentType.HIGHLIGHT,
  rotation: 0,
  height: 1,
  width: 1,
  page: 1,
  positionX: 0,
  positionY: 0,
  color: DEFAULT_CONTENT_HIGHLIGHT_COLOR,
  opacity: DEFAULT_CONTENT_HIGHLIGHT_OPACITY,
};

// IMAGE CONTENT

export const ZContentImageMeta = ZBasePositionalContentMeta.extend({
  rotation: ZContentRotationSchema.optional().default(0),
  type: z.literal(EnvelopeContentType.IMAGE),
});

export type TContentImageMeta = z.infer<typeof ZContentImageMeta>;

export const CONTENT_IMAGE_META_DEFAULT_VALUES: TContentImageMeta = {
  type: EnvelopeContentType.IMAGE,
  rotation: 0,
  height: 1,
  width: 1,
  page: 1,
  positionX: 0,
  positionY: 0,
};

export type TEnvelopeContentMetaSchema =
  | TContentTextMeta
  | TContentLineMeta
  | TContentShapeMeta
  | TContentHighlightMeta
  | TContentImageMeta;

export const CONTENT_META_DEFAULT_VALUES: Record<EnvelopeContentType, TEnvelopeContentMetaSchema> = {
  [EnvelopeContentType.TEXT]: CONTENT_TEXT_META_DEFAULT_VALUES,
  [EnvelopeContentType.LINE]: CONTENT_LINE_META_DEFAULT_VALUES,
  [EnvelopeContentType.SHAPE]: CONTENT_RECTANGLE_META_DEFAULT_VALUES,
  [EnvelopeContentType.HIGHLIGHT]: CONTENT_HIGHLIGHT_META_DEFAULT_VALUES,
  [EnvelopeContentType.IMAGE]: CONTENT_IMAGE_META_DEFAULT_VALUES,
} as const;

export const ZEnvelopeContentMetaSchema = z.union([
  ZContentTextMeta.optional().default(CONTENT_TEXT_META_DEFAULT_VALUES),
  ZContentLineMeta.optional().default(CONTENT_LINE_META_DEFAULT_VALUES),
  ZContentShapeMeta.optional().default(CONTENT_RECTANGLE_META_DEFAULT_VALUES),
  ZContentHighlightMeta.optional().default(CONTENT_HIGHLIGHT_META_DEFAULT_VALUES),
  ZContentImageMeta.optional().default(CONTENT_IMAGE_META_DEFAULT_VALUES),
]);

export type TEnvelopeContentMetaInput = z.input<typeof ZEnvelopeContentMetaSchema>;
export type TEnvelopeContentMetaOutput = z.output<typeof ZEnvelopeContentMetaSchema>;
