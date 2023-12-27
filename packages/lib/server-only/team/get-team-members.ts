import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';

export type GetTeamMembersOptions = {
  /**
   * The optional ID of the user initiating the request.
   *
   * If provided, the user will be checked to ensure they are a member of the team.
   */
  userId?: number;

  /**
   * The ID of the team to retrieve members from.
   */
  teamId: number;
};

/**
 * Get all team members for a given teamId.
 *
 * Provide an optional userId to check that the user is a member of the team.
 */
export const getTeamMembers = async ({ userId, teamId }: GetTeamMembersOptions) => {
  const teamMembers = await prisma.teamMember.findMany({
    where: {
      teamId,
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
    },
  });

  if (userId !== undefined) {
    const teamMember = teamMembers.find((teamMember) => teamMember.userId === userId);

    if (!teamMember) {
      throw new AppError(
        AppErrorCode.UNAUTHORIZED,
        `User ${userId} is not a member of team ${teamId}`,
      );
    }
  }

  return teamMembers;
};
