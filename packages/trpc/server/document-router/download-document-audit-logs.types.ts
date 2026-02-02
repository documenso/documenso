import { z } from 'zod';

export const ZDownloadDocumentAuditLogsRequestSchema = z.object({
  documentId: z.number(),
});

export const ZDownloadDocumentAuditLogsResponseSchema = z.object({
  data: z.string(),
  envelopeTitle: z.string(),
});

export type TDownloadDocumentAuditLogsRequest = z.infer<
  typeof ZDownloadDocumentAuditLogsRequestSchema
>;
export type TDownloadDocumentAuditLogsResponse = z.infer<
  typeof ZDownloadDocumentAuditLogsResponseSchema
>;
