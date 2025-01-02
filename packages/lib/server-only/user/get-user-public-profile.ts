import type { UserProfile } from '@prisma/client';

import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { updatePublicProfile } from './update-public-profile';

export type GetUserPublicProfileOptions = {
  userId: number;
};

type GetUserPublicProfileResponse = {
  profile: UserProfile;
  url: string | null;
};

export const getUserPublicProfile = async ({
  userId,
}: GetUserPublicProfileOptions): Promise<GetUserPublicProfileResponse> => {
  const user = await prisma.user.findFirst({
    where: {
      id: userId,
    },
    include: {
      profile: true,
    },
  });

  if (!user) {
    throw new AppError(AppErrorCode.NOT_FOUND, { message: 'User not found' });
  }

  // Create and return the public profile.
  if (!user.profile) {
    const { url, profile } = await updatePublicProfile({
      userId: user.id,
      data: {
        enabled: false,
      },
    });

    if (!profile) {
      throw new AppError(AppErrorCode.NOT_FOUND, { message: 'Failed to create public profile' });
    }

    return {
      profile,
      url,
    };
  }

  return {
    profile: user.profile,
    url: user.url,
  };
};
