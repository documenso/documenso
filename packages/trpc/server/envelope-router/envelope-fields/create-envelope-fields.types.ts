import { z } from 'zod';

import {
  ZClampedFieldHeightSchema,
  ZClampedFieldPositionXSchema,
  ZClampedFieldPositionYSchema,
  ZClampedFieldWidthSchema,
  ZFieldPageNumberSchema,
  ZFieldSchema,
} from '@documenso/lib/types/field';
import { ZFieldAndMetaSchema } from '@documenso/lib/types/field-meta';

const ZCreateFieldSchema = ZFieldAndMetaSchema.and(
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
  fields: z.array(ZFieldSchema),
});

export type TCreateEnvelopeFieldsRequest = z.infer<typeof ZCreateEnvelopeFieldsRequestSchema>;
export type TCreateEnvelopeFieldsResponse = z.infer<typeof ZCreateEnvelopeFieldsResponseSchema>;
