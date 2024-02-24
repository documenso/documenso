import { prisma } from '@documenso/prisma';
import type { User, UserProfile } from '@documenso/prisma/client';

import { getUserById } from './get-user-by-id';

export type UpdatePublicProfileOptions = {
  id: User['id'];
  profileURL: UserProfile['profileURL'];
};

export const updatePublicProfile = async ({ id, profileURL }: UpdatePublicProfileOptions) => {
  const user = await getUserById({ id });
  // Existence check
  await prisma.userProfile.findFirstOrThrow({
    where: {
      profileURL: user.profileURL ?? undefined,
    },
  });

  return await prisma.$transaction(async (tx) => {
    await tx.userProfile.create({
      data: {
        profileURL,
      },
    });
    await tx.userProfile.update({
      where: {
        profileURL: user.profileURL ?? undefined,
      },
      data: {
        profileURL: profileURL,
      },
    });
  });
};
