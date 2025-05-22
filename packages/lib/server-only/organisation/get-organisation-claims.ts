import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';

export const getOrganisationClaim = async ({ organisationId }: { organisationId: string }) => {
  const organisationClaim = await prisma.organisationClaim.findFirst({
    where: {
      organisation: {
        id: organisationId,
      },
    },
  });

  if (!organisationClaim) {
    throw new AppError(AppErrorCode.NOT_FOUND);
  }

  return organisationClaim;
};

export const getOrganisationClaimByTeamId = async ({ teamId }: { teamId: number }) => {
  const organisationClaim = await prisma.organisationClaim.findFirst({
    where: {
      organisation: {
        teams: {
          some: {
            id: teamId,
          },
        },
      },
    },
  });

  if (!organisationClaim) {
    throw new AppError(AppErrorCode.NOT_FOUND);
  }

  return organisationClaim;
};
