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
 * Returns the highest Organisation and Team role of a given member or user of a team
 */
export const getMemberRoles = async ({ teamId, reference }: GetMemberRolesOptions) => {
  const team = await prisma.team.findFirst({
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
        include: {
          organisationGroup: true,
        },
      },
    },
  });

  if (!team) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Roles not found',
    });
  }

  // Todo: orgs
  console.log({
    groups: team.teamGroups,
    roles: {
      organisationRole: getHighestOrganisationRoleInGroup(
        team.teamGroups.flatMap((group) => group.organisationGroup),
      ),
      teamRole: getHighestTeamRoleInGroup(team.teamGroups),
    },
  });

  return {
    organisationRole: getHighestOrganisationRoleInGroup(
      team.teamGroups.flatMap((group) => group.organisationGroup),
    ),
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

  if (!organisation) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Roles not found',
    });
  }

  return getHighestOrganisationRoleInGroup(organisation.groups);
};
