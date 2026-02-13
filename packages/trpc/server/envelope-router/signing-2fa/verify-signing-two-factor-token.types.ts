import { z } from 'zod';

export const ZVerifySigningTwoFactorTokenRequestSchema = z.object({
  token: z.string().describe('The recipient signing token from the signing URL.'),
  code: z
    .string()
    .min(6)
    .max(6)
    .regex(/^\d{6}$/)
    .describe('The 6-digit one-time code to verify.'),
});

export const ZVerifySigningTwoFactorTokenResponseSchema = z.object({
  verified: z.boolean().describe('Whether the code was successfully verified.'),
  expiresAt: z.date().describe('When the session proof expires.'),
});

export type TVerifySigningTwoFactorTokenRequest = z.infer<
  typeof ZVerifySigningTwoFactorTokenRequestSchema
>;
export type TVerifySigningTwoFactorTokenResponse = z.infer<
  typeof ZVerifySigningTwoFactorTokenResponseSchema
>;
