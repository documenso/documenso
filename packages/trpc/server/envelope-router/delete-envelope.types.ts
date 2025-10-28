import { z } from 'zod';

export const ZDeleteEnvelopeRequestSchema = z.object({
  envelopeId: z.string(),
});

export const ZDeleteEnvelopeResponseSchema = z.void();

export type TDeleteEnvelopeRequest = z.infer<typeof ZDeleteEnvelopeRequestSchema>;
export type TDeleteEnvelopeResponse = z.infer<typeof ZDeleteEnvelopeResponseSchema>;
