import { DocumentSource, DocumentStatus, EnvelopeType } from '@prisma/client';
import { z } from 'zod';

import { ZEnvelopeManySchema } from '@documenso/lib/types/envelope';
import { ZFindResultResponse, ZFindSearchParamsSchema } from '@documenso/lib/types/search-params';

import type { TrpcRouteMeta } from '../trpc';

export const findEnvelopesMeta: TrpcRouteMeta = {
  openapi: {
    method: 'GET',
    path: '/envelope',
    summary: 'Find envelopes',
    description: 'Find envelopes based on search criteria',
    tags: ['Envelope'],
  },
};

export const ZFindEnvelopesRequestSchema = ZFindSearchParamsSchema.extend({
  type: z
    .nativeEnum(EnvelopeType)
    .describe('Filter envelopes by type (DOCUMENT or TEMPLATE).')
    .optional(),
  templateId: z
    .number()
    .describe('Filter envelopes by the template ID used to create it.')
    .optional(),
  source: z
    .nativeEnum(DocumentSource)
    .describe('Filter envelopes by how it was created.')
    .optional(),
  status: z
    .nativeEnum(DocumentStatus)
    .describe('Filter envelopes by the current status.')
    .optional(),
  folderId: z.string().describe('Filter envelopes by folder ID.').optional(),
  orderByColumn: z.enum(['createdAt']).optional(),
  orderByDirection: z.enum(['asc', 'desc']).describe('Sort direction.').default('desc'),
});

export const ZFindEnvelopesResponseSchema = ZFindResultResponse.extend({
  data: ZEnvelopeManySchema.array(),
});

export type TFindEnvelopesRequest = z.infer<typeof ZFindEnvelopesRequestSchema>;
export type TFindEnvelopesResponse = z.infer<typeof ZFindEnvelopesResponseSchema>;
