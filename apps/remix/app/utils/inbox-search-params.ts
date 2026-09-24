import { INBOX_STATUSES } from '@documenso/trpc/server/document-router/find-inbox.types';
import { parseAsStringLiteral } from 'nuqs';

import { documentsSearchParams } from './documents-search-params';

/**
 * Shared nuqs parsers for the inbox page URL state.
 *
 * Reuses the documents parsers so the shared `DocumentSearch` component reads
 * and writes the same params on both pages. An unsupported `status` parses to
 * `null`, which shows every non-draft document.
 */
export const inboxSearchParams = {
  status: parseAsStringLiteral(INBOX_STATUSES),
  page: documentsSearchParams.page,
  perPage: documentsSearchParams.perPage,
  query: documentsSearchParams.query,
};
