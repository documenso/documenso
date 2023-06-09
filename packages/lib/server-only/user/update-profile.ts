import { prisma } from '@documenso/prisma';

export type UpdateProfileOptions = {
  userId: number;
  name: string;
  signature: string;
};

export const updateProfile = async ({
  userId,
  name,
  // TODO: Actually use signature
  signature: _signature,
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
      // signature,
    },
  });

  return updatedUser;
};
