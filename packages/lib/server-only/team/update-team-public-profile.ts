import { prisma } from '@documenso/prisma';

export type UpdatePublicProfileOptions = {
  userId: number;
  teamId: number;
  data: {
    bio?: string;
    enabled?: boolean;
  };
};

export const updateTeamPublicProfile = async ({
  userId,
  teamId,
  data,
}: UpdatePublicProfileOptions) => {
  return await prisma.team.update({
    where: {
      id: teamId,
      members: {
        some: {
          userId,
        },
      },
    },
    data: {
      profile: {
        upsert: {
          create: data,
          update: data,
        },
      },
    },
    include: {
      profile: true,
    },
  });
};
