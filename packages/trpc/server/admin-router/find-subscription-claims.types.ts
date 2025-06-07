import type { z } from 'zod';

import { ZFindResultResponse, ZFindSearchParamsSchema } from '@documenso/lib/types/search-params';
import SubscriptionClaimSchema from '@documenso/prisma/generated/zod/modelSchema/SubscriptionClaimSchema';

export const ZFindSubscriptionClaimsRequestSchema = ZFindSearchParamsSchema.extend({});

export const ZFindSubscriptionClaimsResponseSchema = ZFindResultResponse.extend({
  data: SubscriptionClaimSchema.pick({
    id: true,
    createdAt: true,
    updatedAt: true,
    name: true,
    teamCount: true,
    memberCount: true,
    locked: true,
    flags: true,
  }).array(),
});

export type TFindSubscriptionClaimsRequest = z.infer<typeof ZFindSubscriptionClaimsRequestSchema>;
export type TFindSubscriptionClaimsResponse = z.infer<typeof ZFindSubscriptionClaimsResponseSchema>;
