import { Prisma } from '@prisma/client';

import { prisma } from '@documenso/prisma';

import { buildTeamWhereQuery } from '../../utils/teams';

export type GetRecipientSuggestionsOptions = {
  userId: number;
  teamId?: number;
  query?: string;
};

export const getRecipientSuggestions = async ({
  userId,
  teamId,
  query = '',
}: GetRecipientSuggestionsOptions) => {
  const trimmedQuery = query.trim();
  const limit = 5;

  const recipientFilter: Prisma.RecipientWhereInput = trimmedQuery
    ? {
        OR: [
          {
            name: {
              contains: trimmedQuery,
              mode: Prisma.QueryMode.insensitive,
            },
          },
          {
            email: {
              contains: trimmedQuery,
              mode: Prisma.QueryMode.insensitive,
            },
          },
        ],
      }
    : {};

  const recipients = await prisma.recipient.findMany({
    where: {
      document: {
        team: buildTeamWhereQuery({ teamId, userId }),
      },
      ...recipientFilter,
    },
    select: {
      name: true,
      email: true,
      document: {
        select: {
          createdAt: true,
        },
      },
    },
    distinct: ['email'],
    orderBy: {
      document: {
        createdAt: 'desc',
      },
    },
    take: limit,
  });

  return recipients;
};
