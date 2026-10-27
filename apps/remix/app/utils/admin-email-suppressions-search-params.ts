import { parseAsInteger, parseAsString } from 'nuqs';

/**
 * Shared nuqs parsers for the admin email suppressions page URL state.
 *
 * Used by the page and its table so both parse and serialise the params identically.
 */
export const adminEmailSuppressionsSearchParams = {
  query: parseAsString,
  page: parseAsInteger,
  perPage: parseAsInteger,
};
