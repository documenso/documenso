import sharp from 'sharp';

import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';
import type { ApiRequestMetadata } from '../../universal/extract-request-metadata';

export type SetAvatarImageOptions = {
  userId: number;
  teamId?: number | null;
  bytes?: string | null;
  requestMetadata: ApiRequestMetadata;
};

export const setAvatarImage = async ({
  userId,
  teamId,
  bytes,
  requestMetadata,
}: SetAvatarImageOptions) => {
  let oldAvatarImageId: string | null = null;

  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    include: {
      avatarImage: true,
    },
  });

  if (!user) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'User not found',
    });
  }

  oldAvatarImageId = user.avatarImageId;

  if (teamId) {
    const team = await prisma.team.findFirst({
      where: {
        id: teamId,
        members: {
          some: {
            userId,
          },
        },
      },
    });

    if (!team) {
      throw new AppError('TEAM_NOT_FOUND', {
        statusCode: 404,
      });
    }

    oldAvatarImageId = team.avatarImageId;
  }

  if (oldAvatarImageId) {
    await prisma.avatarImage.delete({
      where: {
        id: oldAvatarImageId,
      },
    });
  }

  let newAvatarImageId: string | null = null;

  if (bytes) {
    const optimisedBytes = await sharp(Buffer.from(bytes, 'base64'))
      .resize(512, 512)
      .toFormat('jpeg', { quality: 75 })
      .toBuffer();

    const avatarImage = await prisma.avatarImage.create({
      data: {
        bytes: optimisedBytes.toString('base64'),
      },
    });

    newAvatarImageId = avatarImage.id;
  }

  if (teamId) {
    await prisma.team.update({
      where: {
        id: teamId,
      },
      data: {
        avatarImageId: newAvatarImageId,
      },
    });

    // TODO: Audit Logs
  } else {
    await prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        avatarImageId: newAvatarImageId,
      },
    });

    // TODO: Audit Logs
  }

  return newAvatarImageId;
};
