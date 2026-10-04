import { z } from 'zod';

export const ZEnableTwoFactorRequestSchema = z.object({
  code: z.string().trim(),
});

export type TEnableTwoFactorRequestSchema = z.infer<typeof ZEnableTwoFactorRequestSchema>;

export const ZDisableTwoFactorRequestSchema = z.object({
  totpCode: z.string().trim().optional(),
  backupCode: z.string().trim().optional(),
});

export type TDisableTwoFactorRequestSchema = z.infer<typeof ZDisableTwoFactorRequestSchema>;

export const ZViewTwoFactorRecoveryCodesRequestSchema = z.object({
  token: z.string().trim(),
});

export type TViewTwoFactorRecoveryCodesRequestSchema = z.infer<typeof ZViewTwoFactorRecoveryCodesRequestSchema>;

/**
 * Completes an OAuth sign in that was paused for a second factor.
 *
 * The user id is never taken from the body: it is read from the signed
 * `pending2fa` cookie set by the OAuth callback, so a client cannot point the
 * request at an arbitrary account.
 */
export const ZCompleteOAuthTwoFactorRequestSchema = z.object({
  totpCode: z.string().trim().optional(),
  backupCode: z.string().trim().optional(),
});

export type TCompleteOAuthTwoFactorRequestSchema = z.infer<typeof ZCompleteOAuthTwoFactorRequestSchema>;
