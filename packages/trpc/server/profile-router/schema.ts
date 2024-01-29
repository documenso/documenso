import { z } from 'zod';

import { ZCurrentPasswordSchema, ZPasswordSchema } from '../auth-router/schema';

export const ZRetrieveUserByIdQuerySchema = z.object({
  id: z.number().min(1),
});

export const ZUpdateProfileMutationSchema = z.object({
  name: z.string().min(1),
  signature: z.string(),
});

export const ZUpdatePasswordMutationSchema = z.object({
  currentPassword: ZCurrentPasswordSchema,
  password: ZPasswordSchema,
});

export const ZForgotPasswordFormSchema = z.object({
  email: z.string().email().min(1),
});

export const ZResetPasswordFormSchema = z.object({
  password: ZPasswordSchema,
  token: z.string().min(1),
});

export const ZConfirmEmailMutationSchema = z.object({
  email: z.string().email().min(1),
});

export type TRetrieveUserByIdQuerySchema = z.infer<typeof ZRetrieveUserByIdQuerySchema>;
export type TUpdateProfileMutationSchema = z.infer<typeof ZUpdateProfileMutationSchema>;
export type TUpdatePasswordMutationSchema = z.infer<typeof ZUpdatePasswordMutationSchema>;
export type TForgotPasswordFormSchema = z.infer<typeof ZForgotPasswordFormSchema>;
export type TResetPasswordFormSchema = z.infer<typeof ZResetPasswordFormSchema>;
export type TConfirmEmailMutationSchema = z.infer<typeof ZConfirmEmailMutationSchema>;
