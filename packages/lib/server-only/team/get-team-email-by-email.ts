import { prisma } from '@documenso/prisma';

export type GetTeamEmailByEmailOptions = {
  email: string;
};

export const getTeamEmailByEmail = async ({ email }: GetTeamEmailByEmailOptions) => {
  return await prisma.teamEmail.findFirst({
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
