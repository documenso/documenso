import { prisma } from '@documenso/prisma';
import { TeamMemberRole } from '@documenso/prisma/client';

export type DeleteTokenByIdOptions = {
  id: number;
  userId: number;
  teamId?: number;
};

export const deleteTokenById = async ({ id, userId, teamId }: DeleteTokenByIdOptions) => {
  if (teamId) {
    const member = await prisma.teamMember.findFirst({
      where: {
        userId,
        teamId,
        role: TeamMemberRole.ADMIN,
      },
    });

    if (!member) {
      throw new Error('თქვენ არ გაქვთ ამ ტოკენის წაშლის უფლება');
    }
  }

  return await prisma.apiToken.delete({
    where: {
      id,
      userId: teamId ? null : userId,
      teamId,
    },
  });
};
