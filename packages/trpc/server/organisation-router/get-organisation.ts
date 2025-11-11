import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { prisma } from '@documenso/prisma';

import { authenticatedProcedure } from '../trpc';
import {
  ZGetOrganisationRequestSchema,
  ZGetOrganisationResponseSchema,
} from './get-organisation.types';

export const getOrganisationRoute = authenticatedProcedure
  //   .meta(getOrganisationMeta)
  .input(ZGetOrganisationRequestSchema)
  .output(ZGetOrganisationResponseSchema)
  .query(async ({ input, ctx }) => {
    const { organisationReference } = input;

    ctx.logger.info({
      input: {
        organisationReference,
      },
    });

    return await getOrganisation({
      userId: ctx.user.id,
      organisationReference,
    });
  });

type GetOrganisationOptions = {
  userId: number;

  /**
   * The ID or URL of the organisation.
   */
  organisationReference: string;
};

export const getOrganisation = async ({
  userId,
  organisationReference,
}: GetOrganisationOptions) => {
  const organisation = await prisma.organisation.findFirst({
    where: {
      OR: [{ id: organisationReference }, { url: organisationReference }],
      members: {
        some: {
          userId,
        },
      },
    },
    include: {
      organisationGlobalSettings: true,
      subscription: true,
      organisationClaim: true,
      members: {
        select: {
          id: true,
        },
      },
      teams: {
        where: {
          teamGroups: {
            some: {
              organisationGroup: {
                organisationGroupMembers: {
                  some: {
                    organisationMember: {
                      userId,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!organisation) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Organisation not found',
    });
  }

  return {
    ...organisation,
    teams: organisation.teams,
  };
};
