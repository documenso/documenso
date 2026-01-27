import { z } from 'zod';

import { ZDocumentAuditLogSchema } from '@documenso/lib/types/document-audit-logs';
import { ZFindResultResponse, ZFindSearchParamsSchema } from '@documenso/lib/types/search-params';

import type { TrpcRouteMeta } from '../trpc';

export const findEnvelopeAuditLogsMeta: TrpcRouteMeta = {
  openapi: {
    method: 'GET',
    path: '/envelope/{envelopeId}/audit-log',
    summary: 'Get envelope audit logs',
    description: 'Find audit logs based on a search criteria',
    tags: ['Envelope'],
  },
};

export const ZFindEnvelopeAuditLogsRequestSchema = ZFindSearchParamsSchema.omit({
  query: true,
}).extend({
  envelopeId: z.string().describe('Envelope ID'),
  orderByColumn: z.enum(['createdAt']).optional(),
  orderByDirection: z.enum(['asc', 'desc']).optional(),
});

export const ZFindEnvelopeAuditLogsResponseSchema = ZFindResultResponse.extend({
  data: ZDocumentAuditLogSchema.array(),
});

export type TFindEnvelopeAuditLogsRequest = z.infer<typeof ZFindEnvelopeAuditLogsRequestSchema>;
export type TFindEnvelopeAuditLogsResponse = z.infer<typeof ZFindEnvelopeAuditLogsResponseSchema>;
