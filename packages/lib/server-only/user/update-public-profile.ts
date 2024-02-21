import { prisma } from '@documenso/prisma';
import type { User, UserProfile } from '@documenso/prisma/client';

import { getUserById } from './get-user-by-id';

export type UpdatePublicProfileOptions = {
  id: User['id'];
  userProfile: UserProfile;
};

export const updatePublicProfile = async ({ id, userProfile }: UpdatePublicProfileOptions) => {
  const user = await getUserById({ id });
  console.log('Adi', user);
  // Existence check
  await prisma.userProfile.findFirstOrThrow({
    where: {
      profileURL: user.profileURL ?? '',
    },
  });

  return await prisma.$transaction(async (tx) => {
    await tx.userProfile.update({
      where: {
        profileURL: user.profileURL!,
      },
      data: {
        profileURL: userProfile.profileURL,
        profileBio: userProfile.profileBio,
      },
    });
  });
};
