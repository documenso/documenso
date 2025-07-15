import { Prisma } from '@prisma/client';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import type { FindResultResponse } from '@documenso/lib/types/search-params';
import { buildOrganisationWhereQuery } from '@documenso/lib/utils/organisations';
import { prisma } from '@documenso/prisma';

import { authenticatedProcedure } from '../trpc';
import {
  ZFindOrganisationEmailsRequestSchema,
  ZFindOrganisationEmailsResponseSchema,
} from './find-organisation-emails.types';

export const findOrganisationEmailsRoute = authenticatedProcedure
  .input(ZFindOrganisationEmailsRequestSchema)
  .output(ZFindOrganisationEmailsResponseSchema)
  .query(async ({ input, ctx }) => {
    const { organisationId, emailDomainId, query, page, perPage } = input;
    const { user } = ctx;

    ctx.logger.info({
      input: {
        organisationId,
      },
    });

    return await findOrganisationEmails({
      userId: user.id,
      organisationId,
      emailDomainId,
      query,
      page,
      perPage,
    });
  });

type FindOrganisationEmailsOptions = {
  userId: number;
  organisationId: string;
  emailDomainId?: string;
  query?: string;
  page?: number;
  perPage?: number;
};

export const findOrganisationEmails = async ({
  userId,
  organisationId,
  emailDomainId,
  query,
  page = 1,
  perPage = 100,
}: FindOrganisationEmailsOptions) => {
  const organisation = await prisma.organisation.findFirst({
    where: buildOrganisationWhereQuery({ organisationId, userId }),
  });

  if (!organisation) {
    throw new AppError(AppErrorCode.NOT_FOUND);
  }

  const whereClause: Prisma.OrganisationEmailWhereInput = {
    organisationId: organisation.id,
    emailDomainId,
  };

  if (query) {
    whereClause.email = {
      contains: query,
      mode: Prisma.QueryMode.insensitive,
    };
  }

  const [data, count] = await Promise.all([
    prisma.organisationEmail.findMany({
      where: whereClause,
      skip: Math.max(page - 1, 0) * perPage,
      take: perPage,
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        createdAt: true,
        updatedAt: true,
        email: true,
        emailName: true,
        // replyTo: true,
        emailDomainId: true,
        organisationId: true,
      },
    }),
    prisma.organisationEmail.count({
      where: whereClause,
    }),
  ]);

  return {
    data,
    count,
    currentPage: page,
    perPage,
    totalPages: Math.ceil(count / perPage),
  } satisfies FindResultResponse<typeof data>;
};
