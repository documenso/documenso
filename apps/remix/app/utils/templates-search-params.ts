import { parseAsInteger, parseAsStringLiteral } from 'nuqs';

export const TEMPLATES_VIEW_VALUES = ['team', 'organisation'] as const;

/**
 * Shared nuqs parsers for the templates page URL state.
 *
 * Used by the templates page and its filter components so every consumer
 * parses and serialises the params identically.
 */
export const templatesSearchParams = {
  view: parseAsStringLiteral(TEMPLATES_VIEW_VALUES),
  page: parseAsInteger,
  perPage: parseAsInteger,
};
