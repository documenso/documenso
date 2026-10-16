import { ExtendedDocumentStatus } from '@documenso/prisma/types/extended-document-status';
import { parseAsArrayOf, parseAsInteger, parseAsString, parseAsStringLiteral } from 'nuqs';

export const DOCUMENTS_PERIOD_VALUES = ['7d', '14d', '30d'] as const;

/**
 * Shared nuqs parsers for the documents page URL state.
 *
 * Used by the documents page and its filter components so every consumer
 * parses and serialises the params identically.
 */
export const documentsSearchParams = {
  status: parseAsStringLiteral(Object.values(ExtendedDocumentStatus)),
  period: parseAsStringLiteral(DOCUMENTS_PERIOD_VALUES),
  senderIds: parseAsArrayOf(parseAsInteger),
  page: parseAsInteger,
  perPage: parseAsInteger,
  query: parseAsString,
};
