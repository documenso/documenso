import { prisma } from '@documenso/prisma';
import { SignatureType } from '@documenso/prisma/client';

export type UpdateProfileOptions = {
  userId: number;
  name: string;
  signature: string;
  signatureType: SignatureType;
};

export const updateProfile = async ({
  userId,
  name,
  signature,
  signatureType,
}: UpdateProfileOptions) => {
  // Existence check
  await prisma.user.findFirstOrThrow({
    where: {
      id: userId,
    },
  });

  const updatedUser = await prisma.user.update({
    where: {
      id: userId,
    },
    data: {
      name,
      signature,
      signatureType,
    },
  });

  return updatedUser;
};
