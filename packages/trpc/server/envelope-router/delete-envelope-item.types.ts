import { z } from 'zod';

export const ZDeleteEnvelopeItemRequestSchema = z.object({
  envelopeId: z.string(),
  envelopeItemId: z.string(),
});

export const ZDeleteEnvelopeItemResponseSchema = z.void();

export type TDeleteEnvelopeItemRequest = z.infer<typeof ZDeleteEnvelopeItemRequestSchema>;
export type TDeleteEnvelopeItemResponse = z.infer<typeof ZDeleteEnvelopeItemResponseSchema>;
