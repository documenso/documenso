import { prisma } from '@documenso/prisma';

import { loadAvatar } from '../../utils/images/avatar';

export type GetAvatarImageOptions = {
  id: string;
};

export const getAvatarImage = async ({ id }: GetAvatarImageOptions) => {
  const avatarImage = await prisma.avatarImage.findFirst({
    where: {
      id,
    },
  });

  if (!avatarImage) {
    return null;
  }

  return await loadAvatar(avatarImage.bytes);
};
