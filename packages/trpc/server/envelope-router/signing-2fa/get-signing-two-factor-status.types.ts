import { z } from 'zod';

export const ZGetSigningTwoFactorStatusRequestSchema = z.object({
  token: z.string().describe('The recipient signing token from the signing URL.'),
});

export const ZGetSigningTwoFactorStatusResponseSchema = z.object({
  required: z.boolean().describe('Whether external 2FA is required for this recipient.'),
  hasActiveToken: z.boolean().describe('Whether an active (unexpired) token exists.'),
  hasValidProof: z.boolean().describe('Whether a valid session proof exists.'),
  tokenExpiresAt: z.date().nullable().describe('When the active token expires, if any.'),
  proofExpiresAt: z.date().nullable().describe('When the session proof expires, if any.'),
  attemptsRemaining: z
    .number()
    .nullable()
    .describe('Remaining verification attempts for the active token.'),
});

export type TGetSigningTwoFactorStatusRequest = z.infer<
  typeof ZGetSigningTwoFactorStatusRequestSchema
>;
export type TGetSigningTwoFactorStatusResponse = z.infer<
  typeof ZGetSigningTwoFactorStatusResponseSchema
>;
