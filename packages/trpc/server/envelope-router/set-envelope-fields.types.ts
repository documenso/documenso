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
      formId: z.string().optional().describe('A temporary ID to keep track of new fields created'),
      envelopeItemId: z.string().describe('The id of the envelope item to put the field on'),
      recipientId: z.number(),
      type: z.nativeEnum(FieldType),
      page: z
        .number()
        .min(1)
        .describe('The page number of the field on the envelope. Starts from 1.'),
      // Todo: Envelopes - Extract these 0-100 schemas with better descriptions.
      positionX: z
        .number()
        .min(0)
        .max(100)
        .describe('The percentage based X position of the field on the envelope.'),
      positionY: z
        .number()
        .min(0)
        .max(100)
        .describe('The percentage based Y position of the field on the envelope.'),
      width: z
        .number()
        .min(0)
        .max(100)
        .describe('The percentage based width of the field on the envelope.'),
      height: z
        .number()
        .min(0)
        .max(100)
        .describe('The percentage based height of the field on the envelope.'),
      fieldMeta: ZFieldMetaSchema, // Todo: Envelopes - Use a more strict form?
    }),
  ),
});

export const ZSetEnvelopeFieldsResponseSchema = z.object({
  fields: z
    .object({
      id: z.number(),
      formId: z.string().optional(),
    })
    .array(),
});

export type TSetEnvelopeFieldsRequest = z.infer<typeof ZSetEnvelopeFieldsRequestSchema>;
export type TSetEnvelopeFieldsResponse = z.infer<typeof ZSetEnvelopeFieldsResponseSchema>;
