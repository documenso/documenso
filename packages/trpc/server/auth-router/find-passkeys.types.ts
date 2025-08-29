import { z } from 'zod';

import { ZFindResultResponse, ZFindSearchParamsSchema } from '@documenso/lib/types/search-params';
import PasskeySchema from '@documenso/prisma/generated/zod/modelSchema/PasskeySchema';

export const ZFindPasskeysRequestSchema = ZFindSearchParamsSchema.extend({
  orderBy: z
    .object({
      column: z.enum(['createdAt', 'updatedAt', 'name']),
      direction: z.enum(['asc', 'desc']),
    })
    .optional(),
});

export const ZFindPasskeysResponseSchema = ZFindResultResponse.extend({
  data: z.array(
    PasskeySchema.pick({
      id: true,
      userId: true,
      name: true,
      createdAt: true,
      updatedAt: true,
      lastUsedAt: true,
      counter: true,
      credentialDeviceType: true,
      credentialBackedUp: true,
      transports: true,
    }),
  ),
});

export type TFindPasskeysRequest = z.infer<typeof ZFindPasskeysRequestSchema>;
export type TFindPasskeysResponse = z.infer<typeof ZFindPasskeysResponseSchema>;
