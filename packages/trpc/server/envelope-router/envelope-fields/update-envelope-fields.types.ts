import { z } from 'zod';

import {
  ZClampedFieldHeightSchema,
  ZClampedFieldPageXSchema,
  ZClampedFieldPageYSchema,
  ZClampedFieldWidthSchema,
  ZFieldPageNumberSchema,
  ZFieldSchema,
} from '@documenso/lib/types/field';
import { ZFieldAndMetaSchema } from '@documenso/lib/types/field-meta';

const ZUpdateFieldSchema = ZFieldAndMetaSchema.and(
  z.object({
    id: z.number().describe('The ID of the field to update.'),
    envelopeItemId: z
      .string()
      .optional()
      .describe(
        'The ID of the envelope item to put the field on. If not provided, field will be placed on the first item.',
      ),
    pageNumber: ZFieldPageNumberSchema.optional(),
    pageX: ZClampedFieldPageXSchema.optional(),
    pageY: ZClampedFieldPageYSchema.optional(),
    width: ZClampedFieldWidthSchema.optional(),
    height: ZClampedFieldHeightSchema.optional(),
  }),
);

export const ZUpdateEnvelopeFieldsRequestSchema = z.object({
  envelopeId: z.string(),
  data: ZUpdateFieldSchema.array(),
});

export const ZUpdateEnvelopeFieldsResponseSchema = z.object({
  fields: z.array(ZFieldSchema),
});

export type TUpdateEnvelopeFieldsRequest = z.infer<typeof ZUpdateEnvelopeFieldsRequestSchema>;
export type TUpdateEnvelopeFieldsResponse = z.infer<typeof ZUpdateEnvelopeFieldsResponseSchema>;
