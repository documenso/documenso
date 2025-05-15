import { z } from 'zod';

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

export const ZCreateCheckoutSessionRequestSchema = z.object({
  priceId: z.string().min(1),
});

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

export const ZSetProfileImageMutationSchema = z.object({
  bytes: z.string().nullish(),
  teamId: z.number().min(1).nullish(),
});

export type TSetProfileImageMutationSchema = z.infer<typeof ZSetProfileImageMutationSchema>;
