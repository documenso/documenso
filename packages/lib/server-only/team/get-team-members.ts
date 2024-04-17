import { prisma } from '@documenso/prisma';

export type GetTeamMembersOptions = {
  userId: number;
  teamId: number;
};

/**
 * Get all team members for a given team.
 */
export const getTeamMembers = async ({ userId, teamId }: GetTeamMembersOptions) => {
  return await prisma.teamMember.findMany({
    where: {
      team: {
        id: teamId,
        members: {
          some: {
            userId: userId,
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
        },
      },
    },
  });
};
