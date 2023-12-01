import { z } from 'zod';

export const ZSetupTwoFactorAuthenticationMutationSchema = z.object({
  password: z.string().min(1),
});

export type TSetupTwoFactorAuthenticationMutationSchema = z.infer<
  typeof ZSetupTwoFactorAuthenticationMutationSchema
>;

export const ZEnableTwoFactorAuthenticationMutationSchema = z.object({
  code: z.string().min(6).max(6),
});

export type TEnableTwoFactorAuthenticationMutationSchema = z.infer<
  typeof ZEnableTwoFactorAuthenticationMutationSchema
>;

export const ZDisableTwoFactorAuthenticationMutationSchema = z.object({
  password: z.string().min(6).max(72),
  backupCode: z.string().trim(),
});

export type TDisableTwoFactorAuthenticationMutationSchema = z.infer<
  typeof ZDisableTwoFactorAuthenticationMutationSchema
>;

export const ZViewRecoveryCodesMutationSchema = z.object({
  password: z.string().min(6).max(72),
});

export type TViewRecoveryCodesMutationSchema = z.infer<typeof ZViewRecoveryCodesMutationSchema>;
