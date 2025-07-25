import { ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP } from '@documenso/lib/constants/organisations';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { getPotentialDomainUsers } from '@documenso/lib/server-only/organisation/domain-organisation';
import { buildOrganisationWhereQuery } from '@documenso/lib/utils/organisations';
import { prisma } from '@documenso/prisma';

import { authenticatedProcedure } from '../trpc';
import {
  ZGetPotentialDomainUsersRequestSchema,
  ZGetPotentialDomainUsersResponseSchema,
} from './get-potential-domain-users.types';

export const getPotentialDomainUsersRoute = authenticatedProcedure
  .input(ZGetPotentialDomainUsersRequestSchema)
  .output(ZGetPotentialDomainUsersResponseSchema)
  .query(async ({ ctx, input }) => {
    const { organisationId, limit = 50 } = input;
    const userId = ctx.user.id;

    ctx.logger.info({
      input: {
        organisationId,
        limit,
      },
    });

    // Verify user has permission to view organisation insights
    const organisation = await prisma.organisation.findFirst({
      where: buildOrganisationWhereQuery({
        organisationId,
        userId,
        roles: ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_ORGANISATION'],
      }),
    });

    if (!organisation) {
      throw new AppError(AppErrorCode.UNAUTHORIZED, {
        message: 'You do not have permission to view potential users for this organisation.',
      });
    }

    const users = await getPotentialDomainUsers(organisationId, limit);

    return {
      users,
      totalCount: users.length,
    };
  });
