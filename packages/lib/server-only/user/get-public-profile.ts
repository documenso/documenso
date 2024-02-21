import { prisma } from '@documenso/prisma';
import type { UserProfile } from '@documenso/prisma/client';

export interface GetPublicProfileByURLOptions {
  profileURL: UserProfile['profileURL'];
}

export const getPublicProfileByURL = async ({ profileURL }: GetPublicProfileByURLOptions) => {
  return await prisma.userProfile.findFirstOrThrow({
    where: {
      profileURL: profileURL,
    },
  });
};
