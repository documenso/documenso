import { z } from 'zod';

export const ZAccessAuthRequest2FAEmailRequestSchema = z.object({
  token: z.string().min(1),
});

export const ZAccessAuthRequest2FAEmailResponseSchema = z.object({
  success: z.boolean(),
  expiresAt: z.date(),
});

export type TAccessAuthRequest2FAEmailRequest = z.infer<
  typeof ZAccessAuthRequest2FAEmailRequestSchema
>;
export type TAccessAuthRequest2FAEmailResponse = z.infer<
  typeof ZAccessAuthRequest2FAEmailResponseSchema
>;
