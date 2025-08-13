import { z } from 'zod';

export const ZResetTwoFactorRequestSchema = z.object({
  userId: z.number(),
});

export const ZResetTwoFactorResponseSchema = z.void();

export type TResetTwoFactorRequest = z.infer<typeof ZResetTwoFactorRequestSchema>;
export type TResetTwoFactorResponse = z.infer<typeof ZResetTwoFactorResponseSchema>;
