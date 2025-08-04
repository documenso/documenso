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

  const nameEmailFilter = trimmedQuery
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
      ...nameEmailFilter,
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
    take: 5,
  });

  if (teamId) {
    const teamMembers = await prisma.organisationMember.findMany({
      where: {
        user: {
          ...nameEmailFilter,
          NOT: { id: userId },
        },
        organisationGroupMembers: {
          some: {
            group: {
              teamGroups: {
                some: { teamId },
              },
            },
          },
        },
      },
      include: {
        user: {
          select: {
            email: true,
            name: true,
          },
        },
      },
      take: 1,
    });

    const recipientEmails = new Set(recipients.map((r) => r.email));
    const uniqueTeamMember = teamMembers
      .filter((member) => !recipientEmails.has(member.user.email))
      .map((member) => ({
        email: member.user.email,
        name: member.user.name,
      }))[0];

    if (uniqueTeamMember) {
      const mixedSuggestions = [...recipients.slice(0, 4), uniqueTeamMember];

      return mixedSuggestions;
    }
  }

  return recipients;
};
