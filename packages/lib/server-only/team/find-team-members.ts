import type { OrganisationMember } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { P, match } from 'ts-pattern';

import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';
import type { FindResultResponse } from '../../types/search-params';
import { getHighestOrganisationRoleInGroup } from '../../utils/organisations';
import { getHighestTeamRoleInGroup } from '../../utils/teams';

export interface FindTeamMembersOptions {
  userId: number;
  teamId: number;
  query?: string;
  page?: number;
  perPage?: number;
  orderBy?: {
    column: keyof OrganisationMember | 'name';
    direction: 'asc' | 'desc';
  };
}

export const findTeamMembers = async ({
  userId,
  teamId,
  query,
  page = 1,
  perPage = 10,
  orderBy,
}: FindTeamMembersOptions) => {
  const orderByColumn = orderBy?.column ?? 'name';
  const orderByDirection = orderBy?.direction ?? 'desc';

  // Check that the user belongs to the team they are trying to find members in.
  const userTeam = await prisma.organisationMember.findFirst({
    where: {
      userId,
      organisationGroupMembers: {
        some: {
          group: {
            teamGroups: {
              some: {
                teamId,
              },
            },
          },
        },
      },
    },
  });

  if (!userTeam) {
    throw new AppError(AppErrorCode.UNAUTHORIZED);
  }

  const termFilters: Prisma.OrganisationMemberWhereInput | undefined = match(query)
    .with(P.string.minLength(1), () => ({
      user: {
        OR: [
          {
            name: {
              contains: query,
              mode: Prisma.QueryMode.insensitive,
            },
          },
          {
            email: {
              contains: query,
              mode: Prisma.QueryMode.insensitive,
            },
          },
        ],
      },
    }))
    .otherwise(() => undefined);

  const whereClause: Prisma.OrganisationMemberWhereInput = {
    ...termFilters,
    organisationGroupMembers: {
      some: {
        group: {
          teamGroups: {
            some: {
              teamId,
            },
          },
        },
      },
    },
  };

  let orderByClause: Prisma.OrganisationMemberOrderByWithRelationInput = {
    [orderByColumn]: orderByDirection,
  };

  // Name field is nested in the user so we have to handle it differently.
  if (orderByColumn === 'name') {
    orderByClause = {
      user: {
        name: orderByDirection,
      },
    };
  }

  const [data, count] = await Promise.all([
    prisma.organisationMember.findMany({
      where: whereClause,
      skip: Math.max(page - 1, 0) * perPage,
      take: perPage,
      orderBy: orderByClause,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            avatarImageId: true,
          },
        },
        organisationGroupMembers: {
          include: {
            group: {
              include: {
                teamGroups: true,
              },
            },
          },
        },
      },
    }),
    prisma.organisationMember.count({
      where: whereClause,
    }),
  ]);

  // same as get-team-members.
  const mappedData = data.map((member) => ({
    id: member.id,
    userId: member.userId,
    createdAt: member.createdAt,
    email: member.user.email,
    name: member.user.name,
    avatarImageId: member.user.avatarImageId,
    // Todo: orgs test this
    teamRole: getHighestTeamRoleInGroup(
      member.organisationGroupMembers.flatMap(({ group }) => group.teamGroups),
    ),
    teamRoleGroupType: member.organisationGroupMembers[0].group.type,
    organisationRole: getHighestOrganisationRoleInGroup(
      member.organisationGroupMembers.flatMap(({ group }) => group),
    ),
  }));

  return {
    data: mappedData,
    count,
    currentPage: Math.max(page, 1),
    perPage,
    totalPages: Math.ceil(count / perPage),
  } satisfies FindResultResponse<typeof mappedData>;
};
