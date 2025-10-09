import { EnvelopeType, FieldType } from '@prisma/client';
import { z } from 'zod';

import { ZFieldMetaSchema } from '@documenso/lib/types/field-meta';

export const ZSetEnvelopeFieldsRequestSchema = z.object({
  envelopeId: z.string(),
  envelopeType: z.nativeEnum(EnvelopeType),
  fields: z.array(
    z.object({
      id: z
        .number()
        .optional()
        .describe('The id of the field. If not provided, a new field will be created.'),
      envelopeItemId: z.string().describe('The id of the envelope item to put the field on'),
      recipientId: z.number(),
      type: z.nativeEnum(FieldType),
      page: z
        .number()
        .min(1)
        .describe('The page number of the field on the envelope. Starts from 1.'),
      positionX: z.number().min(0).describe('The x position of the field on the envelope.'),
      positionY: z.number().min(0).describe('The y position of the field on the envelope.'),
      width: z.number().min(0).describe('The width of the field on the envelope.'),
      height: z.number().min(0).describe('The height of the field on the envelope.'),
      fieldMeta: ZFieldMetaSchema,
    }),
  ),
});

export const ZSetEnvelopeFieldsResponseSchema = z.void();

export type TSetEnvelopeFieldsRequest = z.infer<typeof ZSetEnvelopeFieldsRequestSchema>;
export type TSetEnvelopeFieldsResponse = z.infer<typeof ZSetEnvelopeFieldsResponseSchema>;
