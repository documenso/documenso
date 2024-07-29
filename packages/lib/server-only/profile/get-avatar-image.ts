import sharp from 'sharp';

import { prisma } from '@documenso/prisma';

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

  const bytes = Buffer.from(avatarImage.bytes, 'base64');

  return {
    contentType: 'image/jpeg',
    content: await sharp(bytes).toFormat('jpeg').toBuffer(),
  };
};
