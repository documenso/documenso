import { z } from 'zod';
import { DataContentType } from './data-content-meta';

// Note: The default is different to fields (12), the range is the same.
export const DEFAULT_CONTENT_FONT_SIZE = 10;
export const CONTENT_MIN_FONT_SIZE = 8;
export const CONTENT_MAX_FONT_SIZE = 96;

/**
 * Text layout settings.
 *
 * These mirror the field text settings in value but are owned here so the
 * content schemas, defaults and OpenAPI descriptions do not depend on.
 * Unlike the field equivalents these do not coerce strings and do not accept `null`.
 */
export const CONTENT_MIN_LINE_HEIGHT = 1;
export const CONTENT_MAX_LINE_HEIGHT = 10;
export const DEFAULT_CONTENT_LINE_HEIGHT = 1;

export const CONTENT_MIN_LETTER_SPACING = 0;
export const CONTENT_MAX_LETTER_SPACING = 100;
export const DEFAULT_CONTENT_LETTER_SPACING = 0;

export const ZContentTextAlignSchema = z
  .enum(['left', 'center', 'right'])
  .describe('The horizontal alignment of the text');
export type TContentTextAlign = z.infer<typeof ZContentTextAlignSchema>;

export const DEFAULT_CONTENT_TEXT_ALIGN: TContentTextAlign = 'left';

export const ZContentVerticalAlignSchema = z
  .enum(['top', 'middle', 'bottom'])
  .describe('The vertical alignment of the text');
export type TContentVerticalAlign = z.infer<typeof ZContentVerticalAlignSchema>;

export const DEFAULT_CONTENT_VERTICAL_ALIGN: TContentVerticalAlign = 'middle';

export const ZContentLineHeightSchema = z
  .number()
  .min(CONTENT_MIN_LINE_HEIGHT)
  .max(CONTENT_MAX_LINE_HEIGHT)
  .describe('The line height of the text');

export const ZContentLetterSpacingSchema = z
  .number()
  .min(CONTENT_MIN_LETTER_SPACING)
  .max(CONTENT_MAX_LETTER_SPACING)
  .describe('The spacing between each character');

/**
 * Generic content schemas.
 *
 * All content geometry is percentage based (0-100) relative to the page, unlike
 * fields which are stored in page units and clamped separately.
 */
export const ZContentPageNumberSchema = z.number().min(1).describe('The page number the content will be on.');

export const ZContentPercentageSchema = z.number().min(0).max(100);

export const ZContentPositionXSchema = ZContentPercentageSchema.describe(
  'The percentage based X coordinate where the content will be placed.',
);

export const ZContentPositionYSchema = ZContentPercentageSchema.describe(
  'The percentage based Y coordinate where the content will be placed.',
);

export const ZContentWidthSchema = ZContentPercentageSchema.describe(
  'The percentage based width of the content on the page.',
);

export const ZContentHeightSchema = ZContentPercentageSchema.describe(
  'The percentage based height of the content on the page.',
);

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
 *
 * Non-finite input (`NaN`, `Infinity`) is treated as no rotation rather
 * than propagated, since `%` would turn it into `NaN`.
 */
export const normalizeContentRotation = (rotation: number) => {
  if (!Number.isFinite(rotation)) {
    return 0;
  }

  // `%` keeps the sign of the dividend, so a negative rotation needs the
  // extra `+ 360` before the second `%` to land in the positive range.
  return ((rotation % 360) + 360) % 360;
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

// Todo: Contents - Get the official colors
export const DEFAULT_CONTENT_HIGHLIGHT_COLOR = '#ffe600';
export const DEFAULT_CONTENT_HIGHLIGHT_FILL_OPACITY = 0.4;

// No fill by default, see `fillColor` on the shape meta.
export const DEFAULT_CONTENT_FILL_COLOR = null;
export const DEFAULT_CONTENT_FILL_OPACITY = 1;

/**
 * Opacity as a fraction between 0 (transparent) and 1 (opaque).
 */
export const ZContentOpacitySchema = z.number().min(0).max(1);

/**
 * Stroke width in unscaled page units.
 */
export const CONTENT_MIN_STROKE_WIDTH = 0.5;
export const CONTENT_MAX_STROKE_WIDTH = 20;
export const DEFAULT_CONTENT_STROKE_WIDTH = 1;

/**
 * The highest stacking order an author may give a content.
 *
 * Deliberately low so contents which must always sit above authored ones
 * (e.g. page numbers or redactions in future) can be placed past it without
 * ever colliding with a user value.
 */
export const CONTENT_MAX_Z_INDEX = 10_000;
export const DEFAULT_CONTENT_Z_INDEX = 0;

/**
 * The stacking order among the contents of a page, higher on top. Ties are
 * broken by the content's ID so the order is always deterministic.
 */
export const ZContentZIndexSchema = z.number().int().min(0).max(CONTENT_MAX_Z_INDEX);

export const ZContentStrokeWidthSchema = z.number().min(CONTENT_MIN_STROKE_WIDTH).max(CONTENT_MAX_STROKE_WIDTH);

export const ZContentStrokeStyleSchema = z.enum(['solid', 'dashed', 'dotted']);
export type TContentStrokeStyle = z.infer<typeof ZContentStrokeStyleSchema>;

export const DEFAULT_CONTENT_STROKE_STYLE: TContentStrokeStyle = 'solid';

export enum EnvelopeContentType {
  TEXT = 'text',
  LINE = 'line',
  SHAPE = 'shape',
  HIGHLIGHT = 'highlight',
  IMAGE = 'image',
  // Todo: Contents - Add in next iteration
  // STAMP = 'stamp',
}

export const ZEnvelopeContentTypeSchema = z.nativeEnum(EnvelopeContentType);

/**
 * The types of shape a shape content can be.
 *
 * Example: rectangle, star, arrow, etc.
 */
export enum EnvelopeContentShapeType {
  RECTANGLE = 'rectangle',
}

export const ZEnvelopeContentShapeTypeSchema = z.nativeEnum(EnvelopeContentShapeType);

/**
 * The content types which can currently be rotated, both via the canvas and
 * the settings form.
 *
 * The set is typed against `TRotatableContentMeta` so a type can only be
 * listed here once its meta actually has a `rotation` field, keeping
 * `isRotatableContentMeta` honest.
 */
export const ROTATABLE_CONTENT_TYPES: ReadonlySet<EnvelopeContentType> = new Set<TRotatableContentMeta['type']>([
  EnvelopeContentType.IMAGE,
  // EnvelopeContentType.STAMP,
  EnvelopeContentType.SHAPE,
]);

/**
 * The content types laid out as a box (position, width, height, rotation),
 * i.e. every type except lines, which are drawn between two points.
 *
 * New box types are added here once and the type, meta union and guard
 * below all follow.
 */
export const BOX_CONTENT_TYPES = [
  EnvelopeContentType.TEXT,
  EnvelopeContentType.SHAPE,
  EnvelopeContentType.HIGHLIGHT,
  EnvelopeContentType.IMAGE,
] as const;

export type TBoxContentType = (typeof BOX_CONTENT_TYPES)[number];

/**
 * The type of data content each content type can be linked to, e.g. an
 * uploaded image. Content types not listed cannot hold data.
 */
export const CONTENT_TYPE_DATA_CONTENT_TYPE: Partial<Record<EnvelopeContentType, DataContentType>> = {
  [EnvelopeContentType.IMAGE]: DataContentType.IMAGE,
};

/**
 * Generic positional data for specific content types.
 */
export const ZBasePositionalContentMetaSchema = z.object({
  page: ZContentPageNumberSchema,
  positionX: ZContentPositionXSchema,
  positionY: ZContentPositionYSchema,
  width: ZContentWidthSchema,
  height: ZContentHeightSchema,
  zIndex: ZContentZIndexSchema.optional().default(DEFAULT_CONTENT_Z_INDEX),
});

// TEXT CONTENT

export const ZContentTextMetaSchema = ZBasePositionalContentMetaSchema.extend({
  type: z.literal(EnvelopeContentType.TEXT),
  text: z.string().optional().default(''),
  textAlign: ZContentTextAlignSchema.optional().default(DEFAULT_CONTENT_TEXT_ALIGN),
  verticalAlign: ZContentVerticalAlignSchema.optional().default(DEFAULT_CONTENT_VERTICAL_ALIGN),
  lineHeight: ZContentLineHeightSchema.optional().default(DEFAULT_CONTENT_LINE_HEIGHT),
  letterSpacing: ZContentLetterSpacingSchema.optional().default(DEFAULT_CONTENT_LETTER_SPACING),
  fontSize: z
    .number()
    .min(CONTENT_MIN_FONT_SIZE)
    .max(CONTENT_MAX_FONT_SIZE)
    .optional()
    .default(DEFAULT_CONTENT_FONT_SIZE),
  color: ZContentColorSchema.optional().default(DEFAULT_CONTENT_TEXT_COLOR),
});

export type TContentTextMeta = z.infer<typeof ZContentTextMetaSchema>;

export const CONTENT_TEXT_META_DEFAULT_VALUES: TContentTextMeta = {
  type: EnvelopeContentType.TEXT,
  page: 1,
  positionX: 0,
  positionY: 0,
  width: 1,
  height: 1,
  zIndex: DEFAULT_CONTENT_Z_INDEX,
  text: '',
  textAlign: DEFAULT_CONTENT_TEXT_ALIGN,
  verticalAlign: DEFAULT_CONTENT_VERTICAL_ALIGN,
  lineHeight: DEFAULT_CONTENT_LINE_HEIGHT,
  letterSpacing: DEFAULT_CONTENT_LETTER_SPACING,
  fontSize: DEFAULT_CONTENT_FONT_SIZE,
  color: DEFAULT_CONTENT_TEXT_COLOR,
};

// LINE CONTENT

export const ZContentLineMetaSchema = ZBasePositionalContentMetaSchema.pick({
  page: true,
  zIndex: true,
}).extend({
  type: z.literal(EnvelopeContentType.LINE),

  x1: ZContentPositionXSchema.describe('The percentage based X coordinate where the line starts.'),
  y1: ZContentPositionYSchema.describe('The percentage based Y coordinate where the line starts.'),
  x2: ZContentPositionXSchema.describe('The percentage based X coordinate where the line ends.'),
  y2: ZContentPositionYSchema.describe('The percentage based Y coordinate where the line ends.'),

  strokeWidth: ZContentStrokeWidthSchema.optional().default(DEFAULT_CONTENT_STROKE_WIDTH),
  strokeColor: ZContentColorSchema.optional().default(DEFAULT_CONTENT_STROKE_COLOR),
  strokeStyle: ZContentStrokeStyleSchema.optional().default(DEFAULT_CONTENT_STROKE_STYLE),
});

export type TContentLineMeta = z.infer<typeof ZContentLineMetaSchema>;

export const CONTENT_LINE_META_DEFAULT_VALUES: TContentLineMeta = {
  type: EnvelopeContentType.LINE,
  page: 1,
  x1: 0,
  y1: 0,
  x2: 100,
  y2: 100,
  zIndex: DEFAULT_CONTENT_Z_INDEX,
  strokeWidth: DEFAULT_CONTENT_STROKE_WIDTH,
  strokeColor: DEFAULT_CONTENT_STROKE_COLOR,
  strokeStyle: DEFAULT_CONTENT_STROKE_STYLE,
};

// SHAPE CONTENT

/**
 * A shape within a box, discriminated by `shape`.
 *
 * Every shape currently shares the same stroke and fill settings, so this is a
 * single schema. Turn it into a `discriminatedUnion('shape', ...)` once a
 * shape needs its own fields.
 */
export const ZContentShapeMetaSchema = ZBasePositionalContentMetaSchema.extend({
  type: z.literal(EnvelopeContentType.SHAPE),
  shape: ZEnvelopeContentShapeTypeSchema,
  rotation: ZContentRotationSchema.optional().default(0),

  strokeWidth: ZContentStrokeWidthSchema.optional().default(DEFAULT_CONTENT_STROKE_WIDTH),
  strokeColor: ZContentColorSchema.optional().default(DEFAULT_CONTENT_STROKE_COLOR),
  strokeStyle: ZContentStrokeStyleSchema.optional().default(DEFAULT_CONTENT_STROKE_STYLE),

  /**
   * The fill color, or `null` for no fill.
   */
  fillColor: ZContentColorSchema.nullable().optional().default(DEFAULT_CONTENT_FILL_COLOR),
  fillOpacity: ZContentOpacitySchema.optional().default(DEFAULT_CONTENT_FILL_OPACITY),
});

export type TContentShapeMeta = z.infer<typeof ZContentShapeMetaSchema>;

export const CONTENT_RECTANGLE_META_DEFAULT_VALUES: TContentShapeMeta = {
  type: EnvelopeContentType.SHAPE,
  shape: EnvelopeContentShapeType.RECTANGLE,
  page: 1,
  positionX: 0,
  positionY: 0,
  width: 1,
  height: 1,
  zIndex: DEFAULT_CONTENT_Z_INDEX,
  rotation: 0,
  strokeWidth: DEFAULT_CONTENT_STROKE_WIDTH,
  strokeColor: DEFAULT_CONTENT_STROKE_COLOR,
  strokeStyle: DEFAULT_CONTENT_STROKE_STYLE,
  fillColor: DEFAULT_CONTENT_FILL_COLOR,
  fillOpacity: DEFAULT_CONTENT_FILL_OPACITY,
};

/**
 * The default meta per shape, for when a specific shape is placed.
 */
export const CONTENT_SHAPE_META_DEFAULT_VALUES_BY_SHAPE: Record<EnvelopeContentShapeType, TContentShapeMeta> = {
  [EnvelopeContentShapeType.RECTANGLE]: CONTENT_RECTANGLE_META_DEFAULT_VALUES,
};

/**
 * The default meta for a shape content when no particular shape is asked for.
 */
export const CONTENT_SHAPE_META_DEFAULT_VALUES: TContentShapeMeta = CONTENT_RECTANGLE_META_DEFAULT_VALUES;

// HIGHLIGHT CONTENT

export const ZContentHighlightMetaSchema = ZBasePositionalContentMetaSchema.extend({
  type: z.literal(EnvelopeContentType.HIGHLIGHT),
  color: ZContentColorSchema.optional().default(DEFAULT_CONTENT_HIGHLIGHT_COLOR),
  fillOpacity: ZContentOpacitySchema.optional().default(DEFAULT_CONTENT_HIGHLIGHT_FILL_OPACITY),
});

export type TContentHighlightMeta = z.infer<typeof ZContentHighlightMetaSchema>;

export const CONTENT_HIGHLIGHT_META_DEFAULT_VALUES: TContentHighlightMeta = {
  type: EnvelopeContentType.HIGHLIGHT,
  page: 1,
  positionX: 0,
  positionY: 0,
  width: 1,
  height: 1,
  zIndex: DEFAULT_CONTENT_Z_INDEX,
  color: DEFAULT_CONTENT_HIGHLIGHT_COLOR,
  fillOpacity: DEFAULT_CONTENT_HIGHLIGHT_FILL_OPACITY,
};

// IMAGE CONTENT

export const ZContentImageMetaSchema = ZBasePositionalContentMetaSchema.extend({
  type: z.literal(EnvelopeContentType.IMAGE),
  rotation: ZContentRotationSchema.optional().default(0),
});

export type TContentImageMeta = z.infer<typeof ZContentImageMetaSchema>;

export const CONTENT_IMAGE_META_DEFAULT_VALUES: TContentImageMeta = {
  type: EnvelopeContentType.IMAGE,
  page: 1,
  positionX: 0,
  positionY: 0,
  width: 1,
  height: 1,
  zIndex: DEFAULT_CONTENT_Z_INDEX,
  rotation: 0,
};

export const CONTENT_META_DEFAULT_VALUES: Record<EnvelopeContentType, TEnvelopeContentMeta> = {
  [EnvelopeContentType.TEXT]: CONTENT_TEXT_META_DEFAULT_VALUES,
  [EnvelopeContentType.LINE]: CONTENT_LINE_META_DEFAULT_VALUES,
  [EnvelopeContentType.SHAPE]: CONTENT_SHAPE_META_DEFAULT_VALUES,
  [EnvelopeContentType.HIGHLIGHT]: CONTENT_HIGHLIGHT_META_DEFAULT_VALUES,
  [EnvelopeContentType.IMAGE]: CONTENT_IMAGE_META_DEFAULT_VALUES,
} as const;

export const ZEnvelopeContentMetaSchema = z.discriminatedUnion('type', [
  ZContentTextMetaSchema,
  ZContentLineMetaSchema,
  ZContentShapeMetaSchema,
  ZContentHighlightMetaSchema,
  ZContentImageMetaSchema,
]);

export type TEnvelopeContentMetaInput = z.input<typeof ZEnvelopeContentMetaSchema>;

/**
 * The parsed meta of any content, i.e. with every default applied.
 */
export type TEnvelopeContentMeta = z.output<typeof ZEnvelopeContentMetaSchema>;

/**
 * The meta of any box content, see `BOX_CONTENT_TYPES`.
 */
export type TBoxContentMeta = Extract<TEnvelopeContentMeta, { type: TBoxContentType }>;

export const isBoxContentMeta = (meta: TEnvelopeContentMeta): meta is TBoxContentMeta => {
  // `includes` on a readonly tuple only accepts its own members, so the
  // lookup goes through the wider type.
  const boxContentTypes: readonly EnvelopeContentType[] = BOX_CONTENT_TYPES;

  return boxContentTypes.includes(meta.type);
};

/**
 * The meta of any content which can be rotated, see `ROTATABLE_CONTENT_TYPES`.
 */
export type TRotatableContentMeta = Extract<TEnvelopeContentMeta, { rotation: number }>;

export const isRotatableContentMeta = (meta: TEnvelopeContentMeta): meta is TRotatableContentMeta => {
  return ROTATABLE_CONTENT_TYPES.has(meta.type);
};

/**
 * The rotation of a content in degrees, 0 for content types which cannot be
 * rotated (e.g. text and highlights).
 */
export const getContentRotation = (meta: TEnvelopeContentMeta): number => {
  return isRotatableContentMeta(meta) ? meta.rotation : 0;
};
