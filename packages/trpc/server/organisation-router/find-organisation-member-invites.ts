import type { OrganisationMemberInviteStatus } from '@prisma/client';
import { Prisma } from '@prisma/client';

import { ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP } from '@documenso/lib/constants/organisations';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import type { FindResultResponse } from '@documenso/lib/types/search-params';
import { buildOrganisationWhereQuery } from '@documenso/lib/utils/organisations';
import { prisma } from '@documenso/prisma';

import { authenticatedProcedure } from '../trpc';
import {
  ZFindOrganisationMemberInvitesRequestSchema,
  ZFindOrganisationMemberInvitesResponseSchema,
} from './find-organisation-member-invites.types';

export const findOrganisationMemberInvitesRoute = authenticatedProcedure
  //   .meta(getOrganisationMemberInvitesMeta)
  .input(ZFindOrganisationMemberInvitesRequestSchema)
  .output(ZFindOrganisationMemberInvitesResponseSchema)
  .query(async ({ input, ctx }) => {
    const { organisationId, query, page, perPage, status } = input;
    const { user } = ctx;

    return await findOrganisationMemberInvites({
      userId: user.id,
      organisationId,
      query,
      page,
      perPage,
      status,
    });
  });

type FindOrganisationMemberInvitesOptions = {
  userId: number;
  organisationId: string;
  query?: string;
  page?: number;
  perPage?: number;
  status?: OrganisationMemberInviteStatus;
};

export const findOrganisationMemberInvites = async ({
  userId,
  organisationId,
  query,
  page = 1,
  perPage = 10,
  status,
}: FindOrganisationMemberInvitesOptions) => {
  const organisation = await prisma.organisation.findFirst({
    where: buildOrganisationWhereQuery(
      organisationId,
      userId,
      ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_ORGANISATION'],
    ),
  });

  if (!organisation) {
    throw new AppError(AppErrorCode.NOT_FOUND);
  }

  const whereClause: Prisma.OrganisationMemberInviteWhereInput = {
    organisationId: organisation.id,
    status,
  };

  if (query) {
    whereClause.email = {
      contains: query,
      mode: Prisma.QueryMode.insensitive,
    };
  }

  const [data, count] = await Promise.all([
    prisma.organisationMemberInvite.findMany({
      where: whereClause,
      skip: Math.max(page - 1, 0) * perPage,
      take: perPage,
      orderBy: {
        createdAt: 'desc',
      },
      // Exclude token attribute.
      select: {
        id: true,
        organisationId: true,
        email: true,
        createdAt: true,
        organisationRole: true,
        status: true,
      },
    }),
    prisma.organisationMemberInvite.count({
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
