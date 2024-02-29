import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';

export type UpdatePublicProfileOptions = {
  userId: number;
  url: string;
};

export const updatePublicProfile = async ({ userId, url }: UpdatePublicProfileOptions) => {
  const isUrlTaken = await prisma.user.findFirst({
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

  if (isUrlTaken) {
    throw new AppError(
      AppErrorCode.PROFILE_URL_TAKEN,
      'Profile username is taken',
      'The profile username is already taken',
    );
  }

  return await prisma.user.update({
    where: {
      id: userId,
    },
    data: {
      url,
      userProfile: {
        upsert: {
          create: {
            bio: '',
          },
          update: {
            bio: '',
          },
        },
      },
    },
  });
};
