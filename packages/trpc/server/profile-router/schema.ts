import { z } from 'zod';

import { SignatureType } from '@documenso/prisma/client';

export const ZRetrieveUserByIdQuerySchema = z.object({
  id: z.number().min(1),
});

export const ZUpdateProfileMutationSchema = z.object({
  name: z.string().min(1),
  signature: z.string(),
  signatureType: z.nativeEnum(SignatureType),
});

export const ZUpdatePasswordMutationSchema = z.object({
  currentPassword: z.string().min(6),
  password: z.string().min(6),
});

export const ZForgotPasswordFormSchema = z.object({
  email: z.string().email().min(1),
});

export const ZResetPasswordFormSchema = z.object({
  password: z.string().min(6),
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
