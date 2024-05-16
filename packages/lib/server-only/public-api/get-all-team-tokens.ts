import { prisma } from '@documenso/prisma';
import { TeamMemberRole } from '@documenso/prisma/client';

export type GetUserTokensOptions = {
  userId: number;
  teamId: number;
};

export const getTeamTokens = async ({ userId, teamId }: GetUserTokensOptions) => {
  const teamMember = await prisma.teamMember.findFirst({
    where: {
      userId,
      teamId,
    },
  });

  if (teamMember?.role !== TeamMemberRole.ADMIN) {
    throw new Error('თქვენ არ გაქვთ ამ გუნდის ტოკენების ნახვის უფლება');
  }

  return await prisma.apiToken.findMany({
    where: {
      teamId,
    },
    select: {
      id: true,
      name: true,
      algorithm: true,
      createdAt: true,
      expires: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
};
