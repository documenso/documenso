import { ZFindResultResponse, ZFindSearchParamsSchema } from '@documenso/lib/types/search-params';
import SubscriptionClaimSchema from '@documenso/prisma/generated/zod/modelSchema/SubscriptionClaimSchema';
import type { z } from 'zod';

export const ZFindSubscriptionClaimsRequestSchema = ZFindSearchParamsSchema.extend({});

export const ZFindSubscriptionClaimsResponseSchema = ZFindResultResponse.extend({
  data: SubscriptionClaimSchema.pick({
    id: true,
    createdAt: true,
    updatedAt: true,
    name: true,
    teamCount: true,
    memberCount: true,
    envelopeItemCount: true,
    recipientCount: true,
    locked: true,
    flags: true,
    documentRateLimits: true,
    documentQuota: true,
    emailRateLimits: true,
    emailQuota: true,
    apiRateLimits: true,
    apiQuota: true,
    emailTransportId: true,
  }).array(),
});

export type TFindSubscriptionClaimsRequest = z.infer<typeof ZFindSubscriptionClaimsRequestSchema>;
export type TFindSubscriptionClaimsResponse = z.infer<typeof ZFindSubscriptionClaimsResponseSchema>;
