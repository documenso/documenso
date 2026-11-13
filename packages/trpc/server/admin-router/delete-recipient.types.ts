import { z } from 'zod';

export const ZDeleteRecipientRequestSchema = z.object({
  id: z.number().min(1),
  reason: z.string().trim().min(1).max(500),
});

export const ZDeleteRecipientResponseSchema = z.void();

export type TDeleteRecipientRequest = z.infer<typeof ZDeleteRecipientRequestSchema>;
export type TDeleteRecipientResponse = z.infer<typeof ZDeleteRecipientResponseSchema>;
