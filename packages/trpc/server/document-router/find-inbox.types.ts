// import type { OpenApiMeta } from 'trpc-to-openapi';

import { ZDocumentManySchema } from '@documenso/lib/types/document';
import { ZFindResultResponse, ZFindSearchParamsSchema } from '@documenso/lib/types/search-params';
import { DocumentStatus } from '@prisma/client';
import { z } from 'zod';

export const ZFindInboxRequestSchema = ZFindSearchParamsSchema.extend({
  status: z.nativeEnum(DocumentStatus).optional(),
});

export const ZFindInboxResponseSchema = ZFindResultResponse.extend({
  data: ZDocumentManySchema.array(),
});

export type TFindInboxResponse = z.infer<typeof ZFindInboxResponseSchema>;
