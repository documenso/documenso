import { EnvelopeType, Prisma } from '@prisma/client';

import { buildTeamWhereQuery } from '@documenso/lib/utils/teams';
import { prisma } from '@documenso/prisma';

export type GetRecipientSuggestionsOptions = {
  userId: number;
  teamId: number;
  query: string;
};

export const getRecipientSuggestions = async ({
  userId,
  teamId,
  query,
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
      envelope: {
        type: EnvelopeType.DOCUMENT,
        team: buildTeamWhereQuery({ teamId, userId }),
      },
      ...nameEmailFilter,
    },
    select: {
      name: true,
      email: true,
      envelope: {
        select: {
          createdAt: true,
        },
      },
    },
    distinct: ['email'],
    orderBy: {
      envelope: {
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
      take: 5,
    });

    const uniqueTeamMember = teamMembers.find(
      (member) => !recipients.some((r) => r.email === member.user.email),
    );

    if (uniqueTeamMember) {
      const teamMemberSuggestion = {
        email: uniqueTeamMember.user.email,
        name: uniqueTeamMember.user.name,
      };

      const allSuggestions = [...recipients.slice(0, 4), teamMemberSuggestion];

      return allSuggestions;
    }
  }

  return recipients;
};
