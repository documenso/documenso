import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { prisma } from '@documenso/prisma';
import { TeamMemberRole } from '@documenso/prisma/client';

export type GetUserTokensOptions = {
  userId: number;
  teamId: number;
};

export type GetTeamTokensResponse = Awaited<ReturnType<typeof getTeamTokens>>;

export const getTeamTokens = async ({ userId, teamId }: GetUserTokensOptions) => {
  const teamMember = await prisma.teamMember.findFirst({
    where: {
      userId,
      teamId,
    },
  });

  if (teamMember?.role !== TeamMemberRole.ADMIN) {
    throw new AppError(
      AppErrorCode.UNAUTHORIZED,
      'You do not have the required permissions to view this page.',
    );
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
