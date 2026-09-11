import { z } from 'zod';

export const ZCscSignEnvelopeRequestSchema = z.object({
  recipientToken: z.string().min(1),
  sessionId: z.string().min(1),
});

export const ZCscSignEnvelopeResponseSchema = z.object({
  outcome: z.enum(['signed', 'already_signed']),
});

export type TCscSignEnvelopeRequest = z.infer<typeof ZCscSignEnvelopeRequestSchema>;
export type TCscSignEnvelopeResponse = z.infer<typeof ZCscSignEnvelopeResponseSchema>;
