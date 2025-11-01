import { z } from 'zod';

import { ZEnvelopeFieldSchema } from '@documenso/lib/types/field';

export const ZGetEnvelopeFieldRequestSchema = z.object({
  fieldId: z.number(),
});

export const ZGetEnvelopeFieldResponseSchema = ZEnvelopeFieldSchema;

export type TGetEnvelopeFieldRequest = z.infer<typeof ZGetEnvelopeFieldRequestSchema>;
export type TGetEnvelopeFieldResponse = z.infer<typeof ZGetEnvelopeFieldResponseSchema>;
