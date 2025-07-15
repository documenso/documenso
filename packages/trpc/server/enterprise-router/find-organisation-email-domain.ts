import type { EmailDomainStatus } from '@prisma/client';
import { Prisma } from '@prisma/client';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import type { FindResultResponse } from '@documenso/lib/types/search-params';
import { buildOrganisationWhereQuery } from '@documenso/lib/utils/organisations';
import { prisma } from '@documenso/prisma';

import { authenticatedProcedure } from '../trpc';
import {
  ZFindOrganisationEmailDomainsRequestSchema,
  ZFindOrganisationEmailDomainsResponseSchema,
} from './find-organisation-email-domain.types';

export const findOrganisationEmailDomainsRoute = authenticatedProcedure
  .input(ZFindOrganisationEmailDomainsRequestSchema)
  .output(ZFindOrganisationEmailDomainsResponseSchema)
  .query(async ({ input, ctx }) => {
    const { organisationId, emailDomainId, statuses, query, page, perPage } = input;
    const { user } = ctx;

    ctx.logger.info({
      input: {
        organisationId,
      },
    });

    return await findOrganisationEmailDomains({
      userId: user.id,
      organisationId,
      emailDomainId,
      statuses,
      query,
      page,
      perPage,
    });
  });

type FindOrganisationEmailDomainsOptions = {
  userId: number;
  organisationId: string;
  emailDomainId?: string;
  statuses?: EmailDomainStatus[];
  query?: string;
  page?: number;
  perPage?: number;
};

export const findOrganisationEmailDomains = async ({
  userId,
  organisationId,
  emailDomainId,
  statuses = [],
  query,
  page = 1,
  perPage = 100,
}: FindOrganisationEmailDomainsOptions) => {
  const organisation = await prisma.organisation.findFirst({
    where: buildOrganisationWhereQuery({ organisationId, userId }),
  });

  if (!organisation) {
    throw new AppError(AppErrorCode.NOT_FOUND);
  }

  const whereClause: Prisma.EmailDomainWhereInput = {
    organisationId: organisation.id,
    status: statuses.length > 0 ? { in: statuses } : undefined,
  };

  if (emailDomainId) {
    whereClause.id = emailDomainId;
  }

  if (query) {
    whereClause.domain = {
      contains: query,
      mode: Prisma.QueryMode.insensitive,
    };
  }

  const [data, count] = await Promise.all([
    prisma.emailDomain.findMany({
      where: whereClause,
      skip: Math.max(page - 1, 0) * perPage,
      take: perPage,
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        status: true,
        organisationId: true,
        domain: true,
        selector: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            emails: true,
          },
        },
      },
    }),
    prisma.emailDomain.count({
      where: whereClause,
    }),
  ]);

  const mappedData = data.map((item) => ({
    ...item,
    emailCount: item._count.emails,
  }));

  return {
    data: mappedData,
    count,
    currentPage: page,
    perPage,
    totalPages: Math.ceil(count / perPage),
  } satisfies FindResultResponse<typeof mappedData>;
};
