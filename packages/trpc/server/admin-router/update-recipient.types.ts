import { z } from 'zod';

export const ZUpdateRecipientRequestSchema = z.object({
  id: z.number().min(1),
  name: z.string().optional(),
  email: z.string().email().optional(),
});

export const ZUpdateRecipientResponseSchema = z.void();

export type TUpdateRecipientRequest = z.infer<typeof ZUpdateRecipientRequestSchema>;
export type TUpdateRecipientResponse = z.infer<typeof ZUpdateRecipientResponseSchema>;
