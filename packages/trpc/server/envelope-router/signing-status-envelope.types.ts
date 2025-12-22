import { z } from 'zod';

export const EnvelopeSigningStatus = z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'REJECTED']);

export const ZSigningStatusEnvelopeRequestSchema = z.object({
  token: z.string().describe('The recipient token to check the signing status for'),
});

export const ZSigningStatusEnvelopeResponseSchema = z.object({
  status: EnvelopeSigningStatus.describe('The current signing status of the envelope'),
});

export type TSigningStatusEnvelopeRequest = z.infer<typeof ZSigningStatusEnvelopeRequestSchema>;
export type TSigningStatusEnvelopeResponse = z.infer<typeof ZSigningStatusEnvelopeResponseSchema>;
