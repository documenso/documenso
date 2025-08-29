import { z } from 'zod';

export const ZFindUserSecurityAuditLogsSchema = z.object({
  page: z.number().optional(),
  perPage: z.number().optional(),
});

export type TFindUserSecurityAuditLogsSchema = z.infer<typeof ZFindUserSecurityAuditLogsSchema>;

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

export const ZSubmitSupportTicketMutationSchema = z.object({
  organisationId: z.string(),
  teamId: z.string().min(1).nullish(),
  subject: z.string().min(3, 'Subject is required'),
  message: z.string().min(10, 'Message must be at least 10 characters'),
});

export type TSupportTicketRequest = z.infer<typeof ZSubmitSupportTicketMutationSchema>;
