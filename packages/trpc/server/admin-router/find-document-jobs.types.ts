import { z } from 'zod';

import { ZFindResultResponse, ZFindSearchParamsSchema } from '@documenso/lib/types/search-params';
import BackgroundJobSchema from '@documenso/prisma/generated/zod/modelSchema/BackgroundJobSchema';

export const ZFindDocumentJobsRequestSchema = ZFindSearchParamsSchema.extend({
  envelopeId: z.string(),
});

export const ZFindDocumentJobsResponseSchema = ZFindResultResponse.extend({
  data: BackgroundJobSchema.pick({
    status: true,
    id: true,
    retried: true,
    maxRetries: true,
    jobId: true,
    name: true,
    version: true,
    submittedAt: true,
    updatedAt: true,
    completedAt: true,
    lastRetriedAt: true,
  }).array(),
});

export type TFindDocumentJobsResponse = z.infer<typeof ZFindDocumentJobsResponseSchema>;
