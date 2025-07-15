import { z } from 'zod';

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

export const ZSetProfileImageMutationSchema = z.object({
  bytes: z.string().nullish(),
  teamId: z.number().min(1).nullable(),
  organisationId: z.string().nullable(),
});

export type TSetProfileImageMutationSchema = z.infer<typeof ZSetProfileImageMutationSchema>;
