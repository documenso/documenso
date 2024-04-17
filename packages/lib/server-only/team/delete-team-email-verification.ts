import { TEAM_MEMBER_ROLE_PERMISSIONS_MAP } from '@documenso/lib/constants/teams';
import { prisma } from '@documenso/prisma';

export type DeleteTeamEmailVerificationOptions = {
  userId: number;
  teamId: number;
};

export const deleteTeamEmailVerification = async ({
  userId,
  teamId,
}: DeleteTeamEmailVerificationOptions) => {
  await prisma.$transaction(async (tx) => {
    await tx.team.findFirstOrThrow({
      where: {
        id: teamId,
        members: {
          some: {
            userId,
            role: {
              in: TEAM_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_TEAM'],
            },
          },
        },
      },
    });

    await tx.teamEmailVerification.delete({
      where: {
        teamId,
      },
    });
  });
};
