import { prisma } from '@documenso/prisma';

export type GetTeamsOptions = {
  userId: number;
};
export type GetTeamsResponse = Awaited<ReturnType<typeof getTeams>>;

export const getTeams = async ({ userId }: GetTeamsOptions) => {
  const teams = await prisma.team.findMany({
    where: {
      members: {
        some: {
          userId,
        },
      },
    },
    include: {
      members: {
        where: {
          userId,
        },
        select: {
          role: true,
        },
      },
    },
  });

  return teams.map(({ members, ...team }) => ({
    ...team,
    currentTeamMember: members[0],
  }));
};
