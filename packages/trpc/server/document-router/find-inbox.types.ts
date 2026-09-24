// import type { OpenApiMeta } from 'trpc-to-openapi';

import { ZDocumentManySchema } from '@documenso/lib/types/document';
import { ZFindResultResponse, ZFindSearchParamsSchema } from '@documenso/lib/types/search-params';
import { DocumentStatus } from '@prisma/client';
import { z } from 'zod';

/**
 * The statuses that can be filtered by in the inbox.
 *
 * Every document status except DRAFT, since drafts have not been sent to
 * recipients yet and must never be visible in the inbox.
 *
 * PENDING only covers documents that still need the user to act.
 * PARTIALLY_APPROVED covers pending documents that the user has completed and
 * that wait on other recipients.
 */
export const INBOX_STATUSES = [
  DocumentStatus.PENDING,
  'PARTIALLY_APPROVED',
  DocumentStatus.COMPLETED,
  DocumentStatus.REJECTED,
  DocumentStatus.CANCELLED,
] as const;

export const ZInboxStatusSchema = z.enum(INBOX_STATUSES);

export type TInboxStatus = z.infer<typeof ZInboxStatusSchema>;

export const ZFindInboxRequestSchema = ZFindSearchParamsSchema.extend({
  status: ZInboxStatusSchema.describe('Filter the inbox by document status.').optional(),
});

export const ZFindInboxResponseSchema = ZFindResultResponse.extend({
  data: ZDocumentManySchema.array(),
});

export type TFindInboxRequest = z.infer<typeof ZFindInboxRequestSchema>;
export type TFindInboxResponse = z.infer<typeof ZFindInboxResponseSchema>;
