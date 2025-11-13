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

export const updateEnvelopeFieldsMeta: TrpcRouteMeta = {
  openapi: {
    method: 'POST',
    path: '/envelope/field/update-many',
    summary: 'Update envelope fields',
    description: 'Update multiple envelope fields for an envelope',
    tags: ['Envelope Fields'],
  },
};

const ZUpdateFieldSchema = ZEnvelopeFieldAndMetaSchema.and(
  z.object({
    id: z.number().describe('The ID of the field to update.'),
    envelopeItemId: z
      .string()
      .optional()
      .describe(
        'The ID of the envelope item to put the field on. If not provided, field will be placed on the first item.',
      ),
    page: ZFieldPageNumberSchema.optional(),
    positionX: ZClampedFieldPositionXSchema.optional(),
    positionY: ZClampedFieldPositionYSchema.optional(),
    width: ZClampedFieldWidthSchema.optional(),
    height: ZClampedFieldHeightSchema.optional(),
  }),
);

export const ZUpdateEnvelopeFieldsRequestSchema = z.object({
  envelopeId: z.string(),
  data: ZUpdateFieldSchema.array(),
});

export const ZUpdateEnvelopeFieldsResponseSchema = z.object({
  data: z.array(ZFieldSchema),
});

export type TUpdateEnvelopeFieldsRequest = z.infer<typeof ZUpdateEnvelopeFieldsRequestSchema>;
export type TUpdateEnvelopeFieldsResponse = z.infer<typeof ZUpdateEnvelopeFieldsResponseSchema>;
