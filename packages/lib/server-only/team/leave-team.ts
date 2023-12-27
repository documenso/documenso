import { prisma } from '@documenso/prisma';

export type LeaveTeamOptions = {
  /**
   * The ID of the user who is leaving the team.
   */
  userId: number;

  /**
   * The ID of the team the user is leaving.
   */
  teamId: number;
};

export const leaveTeam = async ({ userId, teamId }: LeaveTeamOptions) => {
  await prisma.teamMember.deleteMany({
    where: {
      teamId,
      userId,
      team: {
        ownerUserId: {
          not: userId,
        },
      },
    },
  });
};
