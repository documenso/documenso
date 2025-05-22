import { prisma } from '@documenso/prisma';

import { buildTeamWhereQuery } from '../../utils/teams';

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

export const getTeamWithEmail = async ({
  userId,
  teamUrl,
}: {
  userId: number;
  teamUrl: string;
}) => {
  return await prisma.team.findFirstOrThrow({
    where: {
      ...buildTeamWhereQuery(undefined, userId),
      url: teamUrl,
    },
    include: {
      teamEmail: true,
      emailVerification: true,
    },
  });
};
