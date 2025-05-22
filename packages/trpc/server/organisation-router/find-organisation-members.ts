import { Prisma } from '@prisma/client';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import type { FindResultResponse } from '@documenso/lib/types/search-params';
import {
  buildOrganisationWhereQuery,
  getHighestOrganisationRoleInGroup,
} from '@documenso/lib/utils/organisations';
import { prisma } from '@documenso/prisma';

import { authenticatedProcedure } from '../trpc';
import {
  ZFindOrganisationMembersRequestSchema,
  ZFindOrganisationMembersResponseSchema,
} from './find-organisation-members.types';

export const findOrganisationMembersRoute = authenticatedProcedure
  //   .meta(getOrganisationMembersMeta)
  .input(ZFindOrganisationMembersRequestSchema)
  .output(ZFindOrganisationMembersResponseSchema)
  .query(async ({ input, ctx }) => {
    const { organisationId } = input;
    const { id } = ctx.user;

    const organisationMembers = await findOrganisationMembers({
      userId: id,
      organisationId,
      query: input.query,
      page: input.page,
      perPage: input.perPage,
    });

    return {
      ...organisationMembers,
      data: organisationMembers.data.map((organisationMember) => {
        const groups = organisationMember.organisationGroupMembers.map((group) => group.group);

        return {
          id: organisationMember.id,
          userId: organisationMember.user.id,
          email: organisationMember.user.email,
          name: organisationMember.user.name || '',
          createdAt: organisationMember.createdAt,
          currentOrganisationRole: getHighestOrganisationRoleInGroup(groups),
          avatarImageId: organisationMember.user.avatarImageId,
          groups,
        };
      }),
    };
  });

type FindOrganisationMembersOptions = {
  userId: number;
  organisationId: string;
  query?: string;
  page?: number;
  perPage?: number;
};

export const findOrganisationMembers = async ({
  userId,
  organisationId,
  query,
  page = 1,
  perPage = 10,
}: FindOrganisationMembersOptions) => {
  const organisation = await prisma.organisation.findFirst({
    where: buildOrganisationWhereQuery(organisationId, userId),
  });

  if (!organisation) {
    throw new AppError(AppErrorCode.NOT_FOUND);
  }

  const whereClause: Prisma.OrganisationMemberWhereInput = {
    organisationId: organisation.id,
  };

  if (query) {
    whereClause.user = {
      OR: [
        {
          email: {
            contains: query,
            mode: Prisma.QueryMode.insensitive,
          },
        },
        {
          name: {
            contains: query,
            mode: Prisma.QueryMode.insensitive,
          },
        },
      ],
    };
  }

  const [data, count] = await Promise.all([
    prisma.organisationMember.findMany({
      where: whereClause,
      skip: Math.max(page - 1, 0) * perPage,
      take: perPage,
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        organisationId: true,
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            avatarImageId: true,
          },
        },
        organisationGroupMembers: {
          select: {
            group: true,
          },
        },
        createdAt: true,
      },
    }),
    prisma.organisationMember.count({
      where: whereClause,
    }),
  ]);

  return {
    data,
    count,
    currentPage: Math.max(page, 1),
    perPage,
    totalPages: Math.ceil(count / perPage),
  } satisfies FindResultResponse<typeof data>;
};
