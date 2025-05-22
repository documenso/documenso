import type { OrganisationGroupType, OrganisationMemberRole } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { unique } from 'remeda';

import type { FindResultResponse } from '@documenso/lib/types/search-params';
import { buildTeamWhereQuery } from '@documenso/lib/utils/teams';
import { prisma } from '@documenso/prisma';

import { authenticatedProcedure } from '../trpc';
import {
  ZFindTeamGroupsRequestSchema,
  ZFindTeamGroupsResponseSchema,
} from './find-team-groups.types';

export const findTeamGroupsRoute = authenticatedProcedure
  // .meta(getTeamGroupsMeta)
  .input(ZFindTeamGroupsRequestSchema)
  .output(ZFindTeamGroupsResponseSchema)
  .query(async ({ input, ctx }) => {
    const { teamId, types, query, page, perPage, teamGroupId, organisationRoles } = input;
    const { user } = ctx;

    return await findTeamGroups({
      userId: user.id,
      teamId,
      teamGroupId,
      types: unique(types || []),
      organisationRoles: unique(organisationRoles || []),
      query,
      page,
      perPage,
    });
  });

type FindTeamGroupsOptions = {
  userId: number;
  teamId: number;
  teamGroupId?: string;
  types?: OrganisationGroupType[];
  organisationRoles?: OrganisationMemberRole[];
  query?: string;
  page?: number;
  perPage?: number;
};

export const findTeamGroups = async ({
  userId,
  teamId,
  teamGroupId,
  types = [],
  organisationRoles = [],
  query,
  page = 1,
  perPage = 10,
}: FindTeamGroupsOptions) => {
  const whereClause: Prisma.TeamGroupWhereInput = {
    team: buildTeamWhereQuery(teamId, userId),
    id: teamGroupId,
    organisationGroup: {
      organisationRole: organisationRoles.length > 0 ? { in: organisationRoles } : undefined,
      type:
        types.length > 0
          ? {
              in: types,
            }
          : undefined,
      ...(query && {
        name: {
          contains: query,
          mode: Prisma.QueryMode.insensitive,
        },
      }),
    },
  };

  const [data, count] = await Promise.all([
    prisma.teamGroup.findMany({
      where: whereClause,
      skip: Math.max(page - 1, 0) * perPage,
      take: perPage,
      orderBy: {
        organisationGroup: {
          name: 'desc',
        },
      },
      select: {
        id: true,
        teamRole: true,
        teamId: true,
        organisationGroup: {
          select: {
            id: true,
            name: true,
            type: true,
            organisationGroupMembers: {
              select: {
                organisationMember: {
                  select: {
                    id: true,
                    user: {
                      select: {
                        id: true,
                        name: true,
                        email: true,
                        avatarImageId: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    }),
    prisma.teamGroup.count({
      where: whereClause,
    }),
  ]);

  const mappedData = data.map((group) => ({
    id: group.id,
    teamId: group.teamId,
    teamRole: group.teamRole,
    name: group.organisationGroup.name || '',
    organisationGroupId: group.organisationGroup.id,
    organisationGroupType: group.organisationGroup.type,
    members: group.organisationGroup.organisationGroupMembers.map(({ organisationMember }) => ({
      id: organisationMember.id,
      userId: organisationMember.user.id,
      name: organisationMember.user.name || '',
      email: organisationMember.user.email,
      avatarImageId: organisationMember.user.avatarImageId,
    })),
  }));

  return {
    data: mappedData,
    count,
    currentPage: Math.max(page, 1),
    perPage,
    totalPages: Math.ceil(count / perPage),
  } satisfies FindResultResponse<typeof mappedData>;
};
