import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { getHighestOrganisationRoleInGroup } from '../../utils/organisations';
import { getHighestTeamRoleInGroup } from '../../utils/teams';

type GetMemberRolesOptions = {
  teamId: number;
  reference:
    | {
        type: 'User';
        id: number;
      }
    | {
        type: 'Member';
        id: string;
      };
};

/**
 * Returns the highest Team role of a given member or user of a team
 */
export const getMemberRoles = async ({ teamId, reference }: GetMemberRolesOptions) => {
  // Enforce incase teamId undefined slips through due to invalid types.
  if (teamId === undefined) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Team not found',
    });
  }

  const team = await prisma.team.findUnique({
    where: {
      id: teamId,
    },
    include: {
      teamGroups: {
        where: {
          organisationGroup: {
            organisationGroupMembers: {
              some: {
                organisationMember:
                  reference.type === 'User'
                    ? {
                        userId: reference.id,
                      }
                    : {
                        id: reference.id,
                      },
              },
            },
          },
        },
      },
    },
  });

  if (!team || team.teamGroups.length === 0) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Roles not found',
    });
  }

  return {
    // Todo: Would be nice bonus to have. If implemented make sure to test hard.
    // organisationRole: getHighestOrganisationRoleInGroup(),
    teamRole: getHighestTeamRoleInGroup(team.teamGroups),
  };
};

type GetMemberOrganisationRoleOptions = {
  organisationId: string;
  reference:
    | {
        type: 'User';
        id: number;
      }
    | {
        type: 'Member';
        id: string;
      };
};

/**
 * Returns the highest Organisation of a given organisation member
 */
export const getMemberOrganisationRole = async ({
  organisationId,
  reference,
}: GetMemberOrganisationRoleOptions) => {
  const organisation = await prisma.organisation.findFirst({
    where: {
      id: organisationId,
    },
    include: {
      groups: {
        where: {
          organisationGroupMembers: {
            some: {
              organisationMember:
                reference.type === 'User'
                  ? {
                      userId: reference.id,
                    }
                  : {
                      id: reference.id,
                    },
            },
          },
        },
      },
    },
  });

  if (!organisation || organisation.groups.length === 0) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Roles not found',
    });
  }

  return getHighestOrganisationRoleInGroup(organisation.groups);
};
