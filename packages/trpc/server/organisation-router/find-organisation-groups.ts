import type { OrganisationGroupType, OrganisationMemberRole } from '@prisma/client';
import { Prisma } from '@prisma/client';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import type { FindResultResponse } from '@documenso/lib/types/search-params';
import { buildOrganisationWhereQuery } from '@documenso/lib/utils/organisations';
import { prisma } from '@documenso/prisma';

import { authenticatedProcedure } from '../trpc';
import {
  ZFindOrganisationGroupsRequestSchema,
  ZFindOrganisationGroupsResponseSchema,
} from './find-organisation-groups.types';

export const findOrganisationGroupsRoute = authenticatedProcedure
  // .meta(getOrganisationGroupsMeta)
  .input(ZFindOrganisationGroupsRequestSchema)
  .output(ZFindOrganisationGroupsResponseSchema)
  .query(async ({ input, ctx }) => {
    const { organisationId, types, query, page, perPage, organisationGroupId, organisationRoles } =
      input;
    const { user } = ctx;

    return await findOrganisationGroups({
      userId: user.id,
      organisationId,
      organisationGroupId,
      organisationRoles,
      types,
      query,
      page,
      perPage,
    });
  });

type FindOrganisationGroupsOptions = {
  userId: number;
  organisationId: string;
  organisationGroupId?: string;
  organisationRoles?: OrganisationMemberRole[];
  types?: OrganisationGroupType[];
  query?: string;
  page?: number;
  perPage?: number;
};

export const findOrganisationGroups = async ({
  userId,
  organisationId,
  organisationGroupId,
  organisationRoles = [],
  types = [],
  query,
  page = 1,
  perPage = 10,
}: FindOrganisationGroupsOptions) => {
  const organisation = await prisma.organisation.findFirst({
    where: buildOrganisationWhereQuery(
      organisationId,
      userId,
      // Todo: Should be fine right?

      // ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_ORGANISATION'],
    ),
  });

  if (!organisation) {
    throw new AppError(AppErrorCode.NOT_FOUND);
  }

  const whereClause: Prisma.OrganisationGroupWhereInput = {
    organisationId: organisation.id,
    type:
      types.length > 0
        ? {
            in: types,
          }
        : undefined,
    organisationRole:
      organisationRoles.length > 0
        ? {
            in: organisationRoles,
          }
        : undefined,
    id: organisationGroupId,
  };

  if (query) {
    whereClause.name = {
      contains: query,
      mode: Prisma.QueryMode.insensitive,
    };
  }

  const [data, count] = await Promise.all([
    prisma.organisationGroup.findMany({
      where: whereClause,
      skip: Math.max(page - 1, 0) * perPage,
      take: perPage,
      orderBy: {
        name: 'desc',
      },
      select: {
        id: true,
        name: true,
        type: true,
        organisationId: true,
        organisationRole: true,
        teamGroups: {
          select: {
            id: true,
            teamId: true,
            teamRole: true,
            team: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        organisationGroupMembers: {
          select: {
            organisationMember: {
              select: {
                id: true,
                user: {
                  select: {
                    id: true,
                    email: true,
                    name: true,
                    avatarImageId: true,
                  },
                },
              },
            },
          },
        },
      },
    }),
    prisma.organisationGroup.count({
      where: whereClause,
    }),
  ]);

  const mappedData = data.map((group) => ({
    ...group,
    teams: group.teamGroups.map((teamGroup) => ({
      id: teamGroup.team.id,
      name: teamGroup.team.name,
      teamGroupId: teamGroup.id,
      teamRole: teamGroup.teamRole,
    })),
    members: group.organisationGroupMembers.map(({ organisationMember }) => ({
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
