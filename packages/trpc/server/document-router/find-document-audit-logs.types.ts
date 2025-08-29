import { z } from 'zod';

import { ZDocumentAuditLogSchema } from '@documenso/lib/types/document-audit-logs';
import { ZFindResultResponse, ZFindSearchParamsSchema } from '@documenso/lib/types/search-params';

export const ZFindDocumentAuditLogsRequestSchema = ZFindSearchParamsSchema.extend({
  documentId: z.number().min(1),
  cursor: z.string().optional(),
  filterForRecentActivity: z.boolean().optional(),
  orderByColumn: z.enum(['createdAt', 'type']).optional(),
  orderByDirection: z.enum(['asc', 'desc']).default('desc'),
});

export const ZFindDocumentAuditLogsResponseSchema = ZFindResultResponse.extend({
  data: ZDocumentAuditLogSchema.array(),
  nextCursor: z.string().optional(),
});

export type TFindDocumentAuditLogsRequest = z.infer<typeof ZFindDocumentAuditLogsRequestSchema>;
export type TFindDocumentAuditLogsResponse = z.infer<typeof ZFindDocumentAuditLogsResponseSchema>;
