import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';

export type UpdatePublicProfileOptions = {
  userId: number;
  data: {
    url?: string;
    bio?: string;
    enabled?: boolean;
  };
};

export const updatePublicProfile = async ({ userId, data }: UpdatePublicProfileOptions) => {
  if (Object.values(data).length === 0) {
    throw new AppError(AppErrorCode.INVALID_BODY, { message: 'Missing data to update' });
  }

  const { url, bio, enabled } = data;

  const user = await prisma.user.findFirst({
    where: {
      id: userId,
    },
  });

  if (!user) {
    throw new AppError(AppErrorCode.NOT_FOUND, { message: 'User not found' });
  }

  const finalUrl = url ?? user.url;

  if (!finalUrl && enabled) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Cannot enable a profile without a URL',
    });
  }

  if (url) {
    const isUrlTakenByAnotherUser = await prisma.user.findFirst({
      select: {
        id: true,
      },
      where: {
        id: {
          not: userId,
        },
        url,
      },
    });

    const isUrlTakenByAnotherTeam = await prisma.team.findFirst({
      select: {
        id: true,
      },
      where: {
        url,
      },
    });

    if (isUrlTakenByAnotherUser || isUrlTakenByAnotherTeam) {
      throw new AppError('PROFILE_URL_TAKEN', {
        message: 'The profile username is already taken',
      });
    }
  }

  return await prisma.user.update({
    where: {
      id: userId,
    },
    data: {
      url,
      profile: {
        upsert: {
          create: {
            bio,
            enabled,
          },
          update: {
            bio,
            enabled,
          },
        },
      },
    },
    include: {
      profile: true,
    },
  });
};
