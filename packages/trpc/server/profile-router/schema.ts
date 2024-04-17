import { z } from 'zod';

<<<<<<< HEAD
=======
import { ZCurrentPasswordSchema, ZPasswordSchema } from '../auth-router/schema';

export const ZFindUserSecurityAuditLogsSchema = z.object({
  page: z.number().optional(),
  perPage: z.number().optional(),
});

>>>>>>> main
export const ZRetrieveUserByIdQuerySchema = z.object({
  id: z.number().min(1),
});

export const ZUpdateProfileMutationSchema = z.object({
  name: z.string().min(1),
  signature: z.string(),
});

<<<<<<< HEAD
export const ZUpdatePasswordMutationSchema = z.object({
  currentPassword: z.string().min(6),
  password: z.string().min(6),
=======
export const ZUpdatePublicProfileMutationSchema = z.object({
  url: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, { message: 'Please enter a valid username.' })
    .regex(/^[a-z0-9-]+$/, {
      message: 'Username can only container alphanumeric characters and dashes.',
    }),
});

export const ZUpdatePasswordMutationSchema = z.object({
  currentPassword: ZCurrentPasswordSchema,
  password: ZPasswordSchema,
>>>>>>> main
});

export const ZForgotPasswordFormSchema = z.object({
  email: z.string().email().min(1),
});

export const ZResetPasswordFormSchema = z.object({
<<<<<<< HEAD
  password: z.string().min(6),
  token: z.string().min(1),
});

=======
  password: ZPasswordSchema,
  token: z.string().min(1),
});

export const ZConfirmEmailMutationSchema = z.object({
  email: z.string().email().min(1),
});

export type TFindUserSecurityAuditLogsSchema = z.infer<typeof ZFindUserSecurityAuditLogsSchema>;
>>>>>>> main
export type TRetrieveUserByIdQuerySchema = z.infer<typeof ZRetrieveUserByIdQuerySchema>;
export type TUpdateProfileMutationSchema = z.infer<typeof ZUpdateProfileMutationSchema>;
export type TUpdatePasswordMutationSchema = z.infer<typeof ZUpdatePasswordMutationSchema>;
export type TForgotPasswordFormSchema = z.infer<typeof ZForgotPasswordFormSchema>;
export type TResetPasswordFormSchema = z.infer<typeof ZResetPasswordFormSchema>;
<<<<<<< HEAD
=======
export type TConfirmEmailMutationSchema = z.infer<typeof ZConfirmEmailMutationSchema>;
>>>>>>> main
