import { ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP } from '@documenso/lib/constants/organisations';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { buildOrganisationWhereQuery } from '@documenso/lib/utils/organisations';
import { prisma } from '@documenso/prisma';

import { authenticatedProcedure } from '../trpc';
import {
  ZListOrganisationDomainsRequestSchema,
  ZListOrganisationDomainsResponseSchema,
} from './list-organisation-domains.types';

export const listOrganisationDomainsRoute = authenticatedProcedure
  .input(ZListOrganisationDomainsRequestSchema)
  .output(ZListOrganisationDomainsResponseSchema)
  .query(async ({ ctx, input }) => {
    const { organisationId, page = 1, perPage = 20 } = input;
    const userId = ctx.user.id;

    ctx.logger.info({
      input: {
        organisationId,
        page,
        perPage,
      },
    });

    // Verify user has permission to view organisation domains
    const organisation = await prisma.organisation.findFirst({
      where: buildOrganisationWhereQuery({
        organisationId,
        userId,
        roles: ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_ORGANISATION'],
      }),
    });

    if (!organisation) {
      throw new AppError(AppErrorCode.UNAUTHORIZED, {
        message: 'You do not have permission to view domains for this organisation.',
      });
    }

    // Get total count for pagination
    const totalCount = await prisma.organisationDomainAccess.count({
      where: {
        organisationId,
      },
    });

    // Get domains with pagination
    const domains = await prisma.organisationDomainAccess.findMany({
      where: {
        organisationId,
      },
      skip: (page - 1) * perPage,
      take: perPage,
      orderBy: {
        domain: 'asc',
      },
      select: {
        id: true,
        domain: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const hasNextPage = totalCount > page * perPage;
    const hasPreviousPage = page > 1;

    return {
      domains,
      totalCount,
      currentPage: page,
      perPage,
      hasNextPage,
      hasPreviousPage,
    };
  });
