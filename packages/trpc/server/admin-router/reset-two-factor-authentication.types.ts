import { z } from 'zod';

export const ZReset2FARequestSchema = z.object({
  id: z.number(),
});

export const ZReset2FAResponseSchema = z.void();

export type TReset2FARequest = z.infer<typeof ZReset2FARequestSchema>;
export type TReset2FAResponse = z.infer<typeof ZReset2FAResponseSchema>;
