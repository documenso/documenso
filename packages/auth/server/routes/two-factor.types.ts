import { z } from 'zod';

export const ZEnableTwoFactorRequestSchema = z.object({
  code: z.string().min(6).max(6),
});

export type TEnableTwoFactorRequestSchema = z.infer<typeof ZEnableTwoFactorRequestSchema>;

export const ZDisableTwoFactorRequestSchema = z.object({
  totpCode: z.string().trim().optional(),
  backupCode: z.string().trim().optional(),
});

export type TDisableTwoFactorRequestSchema = z.infer<typeof ZDisableTwoFactorRequestSchema>;

export const ZViewTwoFactorRecoveryCodesRequestSchema = z.object({
  token: z.string().trim().min(1),
});

export type TViewTwoFactorRecoveryCodesRequestSchema = z.infer<typeof ZViewTwoFactorRecoveryCodesRequestSchema>;

/**
 * Mirrors the email/password sign-in shape (`ZSignInSchema`) for the second
 * factor: one of `totpCode` or `backupCode`, plus the CSRF token the client
 * fetched before submitting (the challenge page is reached via a 302, not the
 * sign-in form, so it fetches its own).
 */
export const ZVerifyTwoFactorChallengeRequestSchema = z.object({
  totpCode: z.string().trim().optional(),
  backupCode: z.string().trim().optional(),
  csrfToken: z.string().trim(),
});

export type TVerifyTwoFactorChallengeRequestSchema = z.infer<typeof ZVerifyTwoFactorChallengeRequestSchema>;
