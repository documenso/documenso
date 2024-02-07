import { prisma } from '@documenso/prisma';

export type GetTeamInvitationsOptions = {
  email: string;
};

export const getTeamInvitations = async ({ email }: GetTeamInvitationsOptions) => {
  return await prisma.teamMemberInvite.findMany({
    where: {
      email,
    },
    include: {
      team: {
        select: {
          id: true,
          name: true,
          url: true,
        },
      },
    },
  });
};
