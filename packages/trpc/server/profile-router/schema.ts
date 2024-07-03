import { z } from 'zod';

import { ZCurrentPasswordSchema, ZPasswordSchema } from '../auth-router/schema';

export const MAX_PROFILE_BIO_LENGTH = 256;

export const ZFindUserSecurityAuditLogsSchema = z.object({
  page: z.number().optional(),
  perPage: z.number().optional(),
});

export type TFindUserSecurityAuditLogsSchema = z.infer<typeof ZFindUserSecurityAuditLogsSchema>;

export const ZRetrieveUserByIdQuerySchema = z.object({
  id: z.number().min(1),
});

export type TRetrieveUserByIdQuerySchema = z.infer<typeof ZRetrieveUserByIdQuerySchema>;

export const ZUpdateProfileMutationSchema = z.object({
  name: z.string().min(1),
  signature: z.string(),
});

export type TUpdateProfileMutationSchema = z.infer<typeof ZUpdateProfileMutationSchema>;

export const ZUpdatePublicProfileMutationSchema = z.object({
  bio: z
    .string()
    .max(MAX_PROFILE_BIO_LENGTH, {
      message: `Bio must be shorter than ${MAX_PROFILE_BIO_LENGTH + 1} characters`,
    })
    .optional(),
  enabled: z.boolean().optional(),
  url: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, { message: 'Please enter a valid username.' })
    .regex(/^[a-z0-9-]+$/, {
      message: 'Username can only container alphanumeric characters and dashes.',
    })
    .optional(),
});

export type TUpdatePublicProfileMutationSchema = z.infer<typeof ZUpdatePublicProfileMutationSchema>;

export const ZUpdatePasswordMutationSchema = z.object({
  currentPassword: ZCurrentPasswordSchema,
  password: ZPasswordSchema,
});

export type TUpdatePasswordMutationSchema = z.infer<typeof ZUpdatePasswordMutationSchema>;

export const ZForgotPasswordFormSchema = z.object({
  email: z.string().email().min(1),
});

export type TForgotPasswordFormSchema = z.infer<typeof ZForgotPasswordFormSchema>;

export const ZResetPasswordFormSchema = z.object({
  password: ZPasswordSchema,
  token: z.string().min(1),
});

export type TResetPasswordFormSchema = z.infer<typeof ZResetPasswordFormSchema>;

export const ZConfirmEmailMutationSchema = z.object({
  email: z.string().email().min(1),
});

export type TConfirmEmailMutationSchema = z.infer<typeof ZConfirmEmailMutationSchema>;

export const ZSetProfileImageMutationSchema = z.object({
  bytes: z.string().nullish(),
  teamId: z.number().min(1).nullish(),
});

export type TSetProfileImageMutationSchema = z.infer<typeof ZSetProfileImageMutationSchema>;
