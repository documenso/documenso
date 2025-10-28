import { z } from 'zod';

export const ZDeleteEnvelopeFieldRequestSchema = z.object({
  fieldId: z.number(),
});

export const ZDeleteEnvelopeFieldResponseSchema = z.void();

export type TDeleteEnvelopeFieldRequest = z.infer<typeof ZDeleteEnvelopeFieldRequestSchema>;
export type TDeleteEnvelopeFieldResponse = z.infer<typeof ZDeleteEnvelopeFieldResponseSchema>;
