import { z } from 'zod';

export const ZDuplicateEnvelopeRequestSchema = z.object({
  envelopeId: z.string(),
});

export const ZDuplicateEnvelopeResponseSchema = z.object({
  duplicatedEnvelopeId: z.string(),
});

export type TDuplicateEnvelopeRequest = z.infer<typeof ZDuplicateEnvelopeRequestSchema>;
export type TDuplicateEnvelopeResponse = z.infer<typeof ZDuplicateEnvelopeResponseSchema>;
