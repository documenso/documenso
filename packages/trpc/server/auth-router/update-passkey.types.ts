import { z } from 'zod';

export const ZUpdatePasskeyRequestSchema = z.object({
  passkeyId: z.string().trim().min(1),
  name: z.string().trim().min(1),
});

export const ZUpdatePasskeyResponseSchema = z.void();

export type TUpdatePasskeyRequest = z.infer<typeof ZUpdatePasskeyRequestSchema>;
export type TUpdatePasskeyResponse = z.infer<typeof ZUpdatePasskeyResponseSchema>;
