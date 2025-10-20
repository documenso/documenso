import { z } from 'zod';

import { ZDocumentManySchema } from '@documenso/lib/types/document';
import { ZFindResultResponse, ZFindSearchParamsSchema } from '@documenso/lib/types/search-params';

export const ZFindDocumentsRequestSchema = ZFindSearchParamsSchema.extend({
  perPage: z.number().optional().default(20),
});

export const ZFindDocumentsResponseSchema = ZFindResultResponse.extend({
  data: ZDocumentManySchema.omit({
    team: true,
  }).array(),
});

export type TFindDocumentsRequest = z.infer<typeof ZFindDocumentsRequestSchema>;
export type TFindDocumentsResponse = z.infer<typeof ZFindDocumentsResponseSchema>;
