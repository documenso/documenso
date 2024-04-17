import { z } from 'zod';

export const ZEnableTwoFactorAuthenticationMutationSchema = z.object({
  code: z.string().min(6).max(6),
});

export type TEnableTwoFactorAuthenticationMutationSchema = z.infer<
  typeof ZEnableTwoFactorAuthenticationMutationSchema
>;

export const ZDisableTwoFactorAuthenticationMutationSchema = z.object({
  token: z.string().trim().min(1),
});

export type TDisableTwoFactorAuthenticationMutationSchema = z.infer<
  typeof ZDisableTwoFactorAuthenticationMutationSchema
>;

export const ZViewRecoveryCodesMutationSchema = z.object({
  token: z.string().trim().min(1),
});

export type TViewRecoveryCodesMutationSchema = z.infer<typeof ZViewRecoveryCodesMutationSchema>;
