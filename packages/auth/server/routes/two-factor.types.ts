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

export type TViewTwoFactorRecoveryCodesRequestSchema = z.infer<
  typeof ZViewTwoFactorRecoveryCodesRequestSchema
>;
