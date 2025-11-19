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

const ZCreateFieldSchema = ZEnvelopeFieldAndMetaSchema.and(
  z.object({
    recipientId: z.number().describe('The ID of the recipient to create the field for'),
    envelopeItemId: z
      .string()
      .optional()
      .describe(
        'The ID of the envelope item to put the field on. If not provided, field will be placed on the first item.',
      ),
    page: ZFieldPageNumberSchema,
    positionX: ZClampedFieldPositionXSchema,
    positionY: ZClampedFieldPositionYSchema,
    width: ZClampedFieldWidthSchema,
    height: ZClampedFieldHeightSchema,
  }),
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
