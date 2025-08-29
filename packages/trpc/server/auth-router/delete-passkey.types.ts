import { z } from 'zod';

export const ZDeletePasskeyRequestSchema = z.object({
  passkeyId: z.string().trim().min(1),
});

export const ZDeletePasskeyResponseSchema = z.void();

export type TDeletePasskeyRequest = z.infer<typeof ZDeletePasskeyRequestSchema>;
export type TDeletePasskeyResponse = z.infer<typeof ZDeletePasskeyResponseSchema>;
