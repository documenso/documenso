// import type { OpenApiMeta } from 'trpc-to-openapi';
import { z } from 'zod';

import { ZDocumentManySchema } from '@documenso/lib/types/document';
import { ZFindResultResponse, ZFindSearchParamsSchema } from '@documenso/lib/types/search-params';

/**
 * Inbox filters.
 *
 * - `ALL`: every non-draft envelope the user is a recipient on.
 * - `WAITING`: only envelopes that are currently waiting on the user to sign/approve,
 *   i.e. it is actually their turn (parallel signing, or sequential signing where every
 *   recipient ahead of them has already signed).
 */
export const ZInboxFilterSchema = z.enum(['ALL', 'WAITING']);

export type TInboxFilter = z.infer<typeof ZInboxFilterSchema>;

export const ZFindInboxRequestSchema = ZFindSearchParamsSchema.extend({
  filter: ZInboxFilterSchema.optional().describe(
    'Filter the inbox to only show envelopes that are waiting on the current user.',
  ),
});

export const ZFindInboxResponseSchema = ZFindResultResponse.extend({
  data: ZDocumentManySchema.extend({
    /**
     * Whether the envelope is currently waiting on the signed-in user to take action
     * (it is their turn to sign/approve and they have not yet done so).
     */
    isWaitingForCurrentUser: z.boolean(),
  }).array(),
});

export type TFindInboxResponse = z.infer<typeof ZFindInboxResponseSchema>;
