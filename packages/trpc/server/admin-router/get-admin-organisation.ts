import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { prisma } from '@documenso/prisma';

import { adminProcedure } from '../trpc';
import {
  ZGetAdminOrganisationRequestSchema,
  ZGetAdminOrganisationResponseSchema,
} from './get-admin-organisation.types';

export const getAdminOrganisationRoute = adminProcedure
  .input(ZGetAdminOrganisationRequestSchema)
  .output(ZGetAdminOrganisationResponseSchema)
  .query(async ({ input, ctx }) => {
    const { organisationId } = input;

    ctx.logger.info({
      input: {
        organisationId,
      },
    });

    return await getAdminOrganisation({
      organisationId,
    });
  });

type GetOrganisationOptions = {
  organisationId: string;
};

export const getAdminOrganisation = async ({ organisationId }: GetOrganisationOptions) => {
  const organisation = await prisma.organisation.findFirst({
    where: {
      id: organisationId,
    },
    include: {
      organisationClaim: true,
      organisationGlobalSettings: true,
      teams: true,
      members: {
        include: {
          organisationGroupMembers: {
            include: {
              group: true,
            },
          },
          user: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
      },
      subscription: true,
    },
  });

  if (!organisation) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Organisation not found',
    });
  }

  return organisation;
};
