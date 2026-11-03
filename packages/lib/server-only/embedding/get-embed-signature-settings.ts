import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { isEmbedSignaturePersistenceEnabled } from '../../utils/billing';

export type GetEmbedSignatureSettingsByTeamIdOptions = {
  teamId: number;
};

export const getEmbedSignatureSettingsByTeamId = async ({ teamId }: GetEmbedSignatureSettingsByTeamIdOptions) => {
  const team = await prisma.team.findFirst({
    where: {
      id: teamId,
    },
    select: {
      organisationId: true,
      organisation: {
        select: {
          organisationClaim: {
            select: {
              flags: true,
            },
          },
        },
      },
    },
  });

  if (!team) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Team not found',
    });
  }

  return {
    organisationId: team.organisationId,
    isEnabled: isEmbedSignaturePersistenceEnabled(team.organisation.organisationClaim.flags),
  };
};
