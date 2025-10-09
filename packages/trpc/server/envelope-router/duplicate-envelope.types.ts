import { EnvelopeType } from '@prisma/client';
import { z } from 'zod';

export const ZDuplicateEnvelopeRequestSchema = z.object({
  envelopeId: z.string(),
  envelopeType: z.nativeEnum(EnvelopeType),
});

export const ZDuplicateEnvelopeResponseSchema = z.object({
  duplicatedEnvelopeId: z.string(),
});

export type TDuplicateEnvelopeRequest = z.infer<typeof ZDuplicateEnvelopeRequestSchema>;
export type TDuplicateEnvelopeResponse = z.infer<typeof ZDuplicateEnvelopeResponseSchema>;
