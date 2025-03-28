import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { prisma } from '@documenso/prisma';

export interface CreateFolderOptions {
  userId: number;
  teamId?: number;
  name: string;
  parentId?: string | null;
}

export const createFolder = async ({
  userId,
  teamId,
  name,
  parentId = null,
}: CreateFolderOptions) => {
  const user = await prisma.user.findFirstOrThrow({
    where: {
      id: userId,
    },
    include: {
      teamMembers: {
        select: {
          teamId: true,
        },
      },
    },
  });

  if (
    teamId !== undefined &&
    !user.teamMembers.some((teamMember) => teamMember.teamId === teamId)
  ) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Team not found',
    });
  }

  if (teamId) {
    await prisma.team.findFirstOrThrow({
      where: {
        id: teamId,
      },
    });
  }

  return await prisma.folder.create({
    data: {
      name,
      userId,
      teamId,
      parentId,
    },
  });
};
