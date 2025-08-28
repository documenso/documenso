import { ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP } from '@documenso/lib/constants/organisations';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { deletedAccountServiceAccount } from '@documenso/lib/server-only/user/service-accounts/deleted-account';
import { buildOrganisationWhereQuery } from '@documenso/lib/utils/organisations';
import { prisma } from '@documenso/prisma';
import { DocumentStatus } from '@documenso/prisma/client';

import { authenticatedProcedure } from '../trpc';
import {
  ZDeleteOrganisationRequestSchema,
  ZDeleteOrganisationResponseSchema,
} from './delete-organisation.types';

export const deleteOrganisationRoute = authenticatedProcedure
  //   .meta(deleteOrganisationMeta)
  .input(ZDeleteOrganisationRequestSchema)
  .output(ZDeleteOrganisationResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { organisationId } = input;
    const { user } = ctx;
    const serviceAccount = await deletedAccountServiceAccount();
    const serviceAccountTeam = serviceAccount.ownedOrganisations[0].teams[0];

    ctx.logger.info({
      input: {
        organisationId,
      },
    });

    const organisation = await prisma.organisation.findFirst({
      where: buildOrganisationWhereQuery({
        organisationId,
        userId: user.id,
        roles: ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP['DELETE_ORGANISATION'],
      }),
      select: {
        id: true,
        owner: {
          select: {
            id: true,
          },
        },
        teams: {
          select: {
            id: true,
            documents: {
              select: {
                id: true,
              },
            },
          },
        },
      },
    });

    if (!organisation) {
      throw new AppError(AppErrorCode.UNAUTHORIZED, {
        message: 'You are not authorized to delete this organisation',
      });
    }

    const organisationOwner = await prisma.user.findUnique({
      where: {
        id: organisation.owner.id,
      },
      include: {
        ownedOrganisations: {
          include: {
            teams: true,
          },
        },
      },
    });

    const documentIds = organisation.teams.flatMap((team) => team.documents.map((doc) => doc.id));

    if (documentIds.length > 0) {
      await prisma.document.deleteMany({
        where: {
          id: {
            in: documentIds,
          },
          status: DocumentStatus.DRAFT,
        },
      });

      if (organisationOwner && organisationOwner.ownedOrganisations.length > 0) {
        const ownerPersonalTeam = organisationOwner.ownedOrganisations[0].teams[0];

        await prisma.document.updateMany({
          where: {
            id: {
              in: documentIds,
            },
            status: {
              not: DocumentStatus.DRAFT,
            },
          },
          data: {
            userId: organisationOwner.id,
            teamId: ownerPersonalTeam.id,
          },
        });
      } else {
        await prisma.document.updateMany({
          where: {
            id: {
              in: documentIds,
            },
            status: {
              not: DocumentStatus.DRAFT,
            },
          },
          data: {
            userId: serviceAccount.id,
            teamId: serviceAccountTeam.id,
            deletedAt: new Date(),
          },
        });
      }
    }

    await prisma.organisation.delete({
      where: {
        id: organisation.id,
      },
    });
  });
