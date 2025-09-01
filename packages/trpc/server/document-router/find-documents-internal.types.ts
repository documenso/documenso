import { z } from 'zod';

import { ZDocumentManySchema } from '@documenso/lib/types/document';
import { ZFindResultResponse } from '@documenso/lib/types/search-params';
import { ExtendedDocumentStatus } from '@documenso/prisma/types/extended-document-status';

import { ZFindDocumentsRequestSchema } from './find-documents.types';

export const ZFindDocumentsInternalRequestSchema = ZFindDocumentsRequestSchema.extend({
  period: z.enum(['7d', '14d', '30d']).optional(),
  senderIds: z.array(z.number()).optional(),
  status: z.nativeEnum(ExtendedDocumentStatus).optional(),
  folderId: z.string().optional(),
});

export const ZFindDocumentsInternalResponseSchema = ZFindResultResponse.extend({
  data: ZDocumentManySchema.array(),
  stats: z.object({
    [ExtendedDocumentStatus.DRAFT]: z.number(),
    [ExtendedDocumentStatus.PENDING]: z.number(),
    [ExtendedDocumentStatus.COMPLETED]: z.number(),
    [ExtendedDocumentStatus.REJECTED]: z.number(),
    [ExtendedDocumentStatus.INBOX]: z.number(),
    [ExtendedDocumentStatus.ALL]: z.number(),
  }),
});

export type TFindDocumentsInternalRequest = z.infer<typeof ZFindDocumentsInternalRequestSchema>;
export type TFindDocumentsInternalResponse = z.infer<typeof ZFindDocumentsInternalResponseSchema>;
