import { z } from 'zod';

import { ZDocumentAuditLogSchema } from '@documenso/lib/types/document-audit-logs';
import { ZFindResultResponse, ZFindSearchParamsSchema } from '@documenso/lib/types/search-params';

import type { TrpcRouteMeta } from '../trpc';

export const findEnvelopeAuditLogsMeta: TrpcRouteMeta = {
  openapi: {
    method: 'GET',
    path: '/envelope/{envelopeId}/audit-log',
    summary: 'Get envelope audit logs',
    description:
      'Returns paginated audit logs for an envelope given an ID. Accepts both envelope IDs (string) and legacy document IDs (number).',
    tags: ['Envelope'],
  },
};

export const ZFindEnvelopeAuditLogsRequestSchema = ZFindSearchParamsSchema.extend({
  envelopeId: z
    .string()
    .describe('Envelope ID (e.g., envelope_xxx) or legacy document ID (e.g., 12345)'),
  cursor: z.string().optional(),
  filterForRecentActivity: z.boolean().optional(),
  orderByColumn: z.enum(['createdAt', 'type']).optional(),
  orderByDirection: z.enum(['asc', 'desc']).default('desc'),
});

export const ZFindEnvelopeAuditLogsResponseSchema = ZFindResultResponse.extend({
  data: ZDocumentAuditLogSchema.array(),
  nextCursor: z.string().optional(),
});

export type TFindEnvelopeAuditLogsRequest = z.infer<typeof ZFindEnvelopeAuditLogsRequestSchema>;
export type TFindEnvelopeAuditLogsResponse = z.infer<typeof ZFindEnvelopeAuditLogsResponseSchema>;
