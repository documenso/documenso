import { z } from 'zod';

export const ZDeleteEnvelopeRecipientRequestSchema = z.object({
  recipientId: z.number(),
});

export const ZDeleteEnvelopeRecipientResponseSchema = z.void();

export type TDeleteEnvelopeRecipientRequest = z.infer<typeof ZDeleteEnvelopeRecipientRequestSchema>;
export type TDeleteEnvelopeRecipientResponse = z.infer<
  typeof ZDeleteEnvelopeRecipientResponseSchema
>;
