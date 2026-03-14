import { EnvelopeType, FieldType } from '@prisma/client';
import { z } from 'zod';

import {
  ZClampedFieldHeightSchema,
  ZClampedFieldPositionXSchema,
  ZClampedFieldPositionYSchema,
  ZClampedFieldWidthSchema,
  ZEnvelopeFieldSchema,
} from '@documenso/lib/types/field';
import { ZFieldMetaSchema } from '@documenso/lib/types/field-meta';

export const ZSetEnvelopeFieldsRequestSchema = z.object({
  envelopeId: z.string(),
  envelopeType: z.nativeEnum(EnvelopeType),
  fields: z.array(
    // Todo: Envelopes - Use strict schema for types + field meta.
    z.object({
      id: z
        .number()
        .optional()
        .describe('The id of the field. If not provided, a new field will be created.'),
      formId: z.string().optional().describe('A temporary ID to keep track of new fields created'),
      envelopeItemId: z.string().describe('The id of the envelope item to put the field on'),
      recipientId: z.number(),
      type: z.nativeEnum(FieldType),
      page: z
        .number()
        .min(1)
        .describe('The page number of the field on the envelope. Starts from 1.'),
      positionX: ZClampedFieldPositionXSchema,
      positionY: ZClampedFieldPositionYSchema,
      width: ZClampedFieldWidthSchema,
      height: ZClampedFieldHeightSchema,
      fieldMeta: ZFieldMetaSchema,
    }),
  ),
});

export const ZSetEnvelopeFieldsResponseSchema = z.object({
  data: ZEnvelopeFieldSchema.extend({
    formId: z.string().optional(),
  }).array(),
});

export type TSetEnvelopeFieldsRequest = z.infer<typeof ZSetEnvelopeFieldsRequestSchema>;
export type TSetEnvelopeFieldsResponse = z.infer<typeof ZSetEnvelopeFieldsResponseSchema>;
