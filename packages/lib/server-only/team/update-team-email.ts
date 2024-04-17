import { prisma } from '@documenso/prisma';

import { TEAM_MEMBER_ROLE_PERMISSIONS_MAP } from '../../constants/teams';

export type UpdateTeamEmailOptions = {
  userId: number;
  teamId: number;
  data: {
    name: string;
  };
};

export const updateTeamEmail = async ({ userId, teamId, data }: UpdateTeamEmailOptions) => {
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
        teamEmail: {
          isNot: null,
        },
      },
    });

    await tx.teamEmail.update({
      where: {
        teamId,
      },
      data: {
        // Note: Never allow the email to be updated without re-verifying via email.
        name: data.name,
      },
    });
  });
};
