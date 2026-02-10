import { z } from 'zod';

import {
  ZClampedFieldHeightSchema,
  ZClampedFieldPositionXSchema,
  ZClampedFieldPositionYSchema,
  ZClampedFieldWidthSchema,
  ZFieldPageNumberSchema,
  ZFieldSchema,
} from '@documenso/lib/types/field';
import { ZEnvelopeFieldAndMetaSchema } from '@documenso/lib/types/field-meta';

import type { TrpcRouteMeta } from '../../trpc';

export const createEnvelopeFieldsMeta: TrpcRouteMeta = {
  openapi: {
    method: 'POST',
    path: '/envelope/field/create-many',
    summary: 'Create envelope fields',
    description: 'Create multiple fields for an envelope',
    tags: ['Envelope Fields'],
  },
};

const ZCreateFieldBaseSchema = ZEnvelopeFieldAndMetaSchema.and(
  z.object({
    recipientId: z.number().describe('The ID of the recipient to create the field for'),
    envelopeItemId: z
      .string()
      .optional()
      .describe(
        'The ID of the envelope item to put the field on. If not provided, field will be placed on the first item.',
      ),
  }),
);

/**
 * Position a field using explicit percentage-based coordinates.
 */
const ZCoordinatePositionSchema = z.object({
  page: ZFieldPageNumberSchema,
  positionX: ZClampedFieldPositionXSchema,
  positionY: ZClampedFieldPositionYSchema,
  width: ZClampedFieldWidthSchema,
  height: ZClampedFieldHeightSchema,
});

/**
 * Position a field using a PDF text placeholder (e.g. "{{name}}").
 *
 * The placeholder text is matched in the envelope item's PDF and the field is
 * placed at the bounding box of that match. Width and height can optionally be
 * overridden; when omitted the dimensions of the placeholder text are used.
 */
const ZPlaceholderPositionSchema = z.object({
  placeholder: z
    .string()
    .describe(
      'Text to search for in the PDF (e.g. "{{name}}"). The field will be placed at the location of this text.',
    ),
  width: ZClampedFieldWidthSchema.optional().describe(
    'Override the width of the field. When omitted, the width of the placeholder text is used.',
  ),
  height: ZClampedFieldHeightSchema.optional().describe(
    'Override the height of the field. When omitted, the height of the placeholder text is used.',
  ),
  matchAll: z
    .boolean()
    .optional()
    .describe(
      'When true, creates a field at every occurrence of the placeholder in the PDF. When false or omitted, only the first occurrence is used.',
    ),
});

const ZCreateFieldSchema = ZCreateFieldBaseSchema.and(
  z.union([ZCoordinatePositionSchema, ZPlaceholderPositionSchema]),
);

export const ZCreateEnvelopeFieldsRequestSchema = z.object({
  envelopeId: z.string(),
  data: ZCreateFieldSchema.array(),
});

export const ZCreateEnvelopeFieldsResponseSchema = z.object({
  data: z.array(ZFieldSchema),
});

export type TCreateEnvelopeFieldsRequest = z.infer<typeof ZCreateEnvelopeFieldsRequestSchema>;
export type TCreateEnvelopeFieldsResponse = z.infer<typeof ZCreateEnvelopeFieldsResponseSchema>;
