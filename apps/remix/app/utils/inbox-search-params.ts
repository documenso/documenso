import type { ExtendedDocumentStatus } from '@documenso/prisma/types/extended-document-status';
import { INBOX_STATUSES, type TInboxStatus } from '@documenso/trpc/server/document-router/find-inbox.types';

import { documentsSearchParams } from './documents-search-params';

/**
 * The statuses that can be selected from the inbox status filter.
 */
export const INBOX_SELECTABLE_STATUSES: ExtendedDocumentStatus[] = [...INBOX_STATUSES];

/**
 * Shared nuqs parsers for the inbox page URL state.
 *
 * Reuses the documents parsers so the shared filter components
 * (`DocumentSearch`, `DocumentsTableStatusFilter`) read and write the same
 * params on both pages.
 */
export const inboxSearchParams = {
  status: documentsSearchParams.status,
  page: documentsSearchParams.page,
  perPage: documentsSearchParams.perPage,
  query: documentsSearchParams.query,
};

/**
 * Narrows the URL `status` param to a status supported by the inbox.
 *
 * Returns `undefined` when it is missing or not selectable, which shows every
 * non-draft document.
 */
export const resolveInboxStatus = (status: ExtendedDocumentStatus | null): TInboxStatus | undefined => {
  return INBOX_STATUSES.find((value) => value === status);
};
