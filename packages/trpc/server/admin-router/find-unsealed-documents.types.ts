import { z } from 'zod';

import { ZFindResultResponse, ZFindSearchParamsSchema } from '@documenso/lib/types/search-params';

export const ZFindUnsealedDocumentsRequestSchema = ZFindSearchParamsSchema.pick({
  page: true,
  perPage: true,
}).extend({
  perPage: z.number().optional().default(20),
});

export const ZAdminUnsealedDocumentSchema = z.object({
  id: z.string(),
  secondaryId: z.string(),
  title: z.string(),
  status: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  userId: z.number(),
  teamId: z.number(),
  ownerName: z.string().nullable(),
  ownerEmail: z.string(),
  lastSignedAt: z.date().nullable(),
});

export const ZFindUnsealedDocumentsResponseSchema = ZFindResultResponse.extend({
  data: ZAdminUnsealedDocumentSchema.array(),
});

export type TFindUnsealedDocumentsRequest = z.infer<typeof ZFindUnsealedDocumentsRequestSchema>;
export type TFindUnsealedDocumentsResponse = z.infer<typeof ZFindUnsealedDocumentsResponseSchema>;
