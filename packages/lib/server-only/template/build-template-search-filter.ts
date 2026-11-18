import type { Prisma } from '@prisma/client';

/**
 * Builds the search clause for template listings.
 *
 * Matches the same fields as the documents search so both pages behave the
 * same way: title, external ID, and recipient name or email.
 *
 * Returns `null` when the query is empty so callers can skip the clause.
 */
export const buildTemplateSearchFilter = (query?: string): Prisma.EnvelopeWhereInput | null => {
  const searchQuery = query?.trim() ?? '';

  if (searchQuery.length === 0) {
    return null;
  }

  return {
    OR: [
      { title: { contains: searchQuery, mode: 'insensitive' } },
      { externalId: { contains: searchQuery, mode: 'insensitive' } },
      {
        recipients: {
          some: {
            OR: [
              { name: { contains: searchQuery, mode: 'insensitive' } },
              { email: { contains: searchQuery, mode: 'insensitive' } },
            ],
          },
        },
      },
    ],
  };
};
