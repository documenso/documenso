// import type { OpenApiMeta } from 'trpc-to-openapi';
import type { z } from 'zod';

import { ZDocumentManySchema } from '@doku-seal/lib/types/document';
import { ZFindResultResponse, ZFindSearchParamsSchema } from '@doku-seal/lib/types/search-params';

export const ZFindInboxRequestSchema = ZFindSearchParamsSchema;

export const ZFindInboxResponseSchema = ZFindResultResponse.extend({
  data: ZDocumentManySchema.array(),
});

export type TFindInboxResponse = z.infer<typeof ZFindInboxResponseSchema>;
