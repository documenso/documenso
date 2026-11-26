import { ZFindResultResponse } from '@documenso/lib/types/search-params';
import { ZTemplateManySchema } from '@documenso/lib/types/template';
import { z } from 'zod';

import { ZFindTemplatesRequestSchema } from './schema';

export const ZFindTemplatesInternalRequestSchema = ZFindTemplatesRequestSchema.extend({
  ownerIds: z.array(z.number()).optional(),
});

// Kept off ZTemplateManySchema so the deprecated public template API response stays unchanged.
export const ZFindTemplatesInternalResponseSchema = ZFindResultResponse.extend({
  data: ZTemplateManySchema.extend({
    targetFolderId: z.string().nullable(),
  }).array(),
});

export type TFindTemplatesInternalRequest = z.infer<typeof ZFindTemplatesInternalRequestSchema>;
export type TFindTemplatesInternalResponse = z.infer<typeof ZFindTemplatesInternalResponseSchema>;
