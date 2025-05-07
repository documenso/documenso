import { prisma } from '@documenso/prisma';
import type { TGetTeamMembersResponse } from '@documenso/trpc/server/team-router/get-team-members.types';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { getHighestOrganisationRoleInGroup } from '../../utils/organisations';
import { getHighestTeamRoleInGroup } from '../../utils/teams';

export type GetTeamMembersOptions = {
  userId: number;
  teamId: number;
};

/**
 * Get all team members for a given team.
 */
export const getTeamMembers = async ({
  userId,
  teamId,
}: GetTeamMembersOptions): Promise<TGetTeamMembersResponse> => {
  const teamMembers = await prisma.organisationMember.findMany({
    where: {
      organisationGroupMembers: {
        some: {
          group: {
            teamGroups: {
              some: {
                teamId,
              },
            },
          },
        },
      },
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          avatarImageId: true,
        },
      },
      organisationGroupMembers: {
        include: {
          group: {
            include: {
              teamGroups: true,
            },
          },
        },
      },
    },
  });

  const isAuthorized = teamMembers.some((member) => member.userId === userId);

  // Checks that the user is part of the organisation/team.
  if (!isAuthorized) {
    throw new AppError(AppErrorCode.UNAUTHORIZED);
  }

  return teamMembers.map((member) => {
    const memberGroups = member.organisationGroupMembers.map((group) => group.group);

    return {
      id: member.id,
      userId: member.userId,
      createdAt: member.createdAt,
      email: member.user.email,
      name: member.user.name,
      avatarImageId: member.user.avatarImageId,
      // Todo: orgs test this
      teamRole: getHighestTeamRoleInGroup(memberGroups.flatMap((group) => group.teamGroups)),
      organisationRole: getHighestOrganisationRoleInGroup(memberGroups),
    };
  });
};
