import { z } from 'zod';

export const ZAdminDownloadDocumentAuditLogsRequestSchema = z.object({
  envelopeId: z.string(),
});

export const ZAdminDownloadDocumentAuditLogsResponseSchema = z.object({
  data: z.string(),
  envelopeTitle: z.string(),
});

export type TAdminDownloadDocumentAuditLogsRequest = z.infer<
  typeof ZAdminDownloadDocumentAuditLogsRequestSchema
>;
export type TAdminDownloadDocumentAuditLogsResponse = z.infer<
  typeof ZAdminDownloadDocumentAuditLogsResponseSchema
>;
