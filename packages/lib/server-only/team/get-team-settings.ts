import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { buildTeamWhereQuery, extractDerivedTeamSettings } from '../../utils/teams';

export type GetTeamSettingsOptions = {
  userId?: number;
  teamId: number;
};

/**
 * You must provide userId if you want to validate whether the user can access the team settings.
 */
export const getTeamSettings = async ({ userId, teamId }: GetTeamSettingsOptions) => {
  const team = await prisma.team.findFirst({
    where: userId !== undefined ? buildTeamWhereQuery(teamId, userId) : { id: teamId },
    include: {
      organisation: {
        include: {
          organisationGlobalSettings: true,
        },
      },
      teamGlobalSettings: true,
    },
  });

  if (!team) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Team not found',
    });
  }

  const organisationSettings = team.organisation.organisationGlobalSettings;
  const teamSettings = team.teamGlobalSettings;

  return extractDerivedTeamSettings(organisationSettings, teamSettings);
};
