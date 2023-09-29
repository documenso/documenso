import { prisma } from '@documenso/prisma';
import { Role } from '@documenso/prisma/client';

export type UpdateUserOptions = {
  userId: number;
  name: string;
  email: string;
  roles: Role[];
};

export const updateUser = async ({ userId, name, email, roles }: UpdateUserOptions) => {
  console.log('wtf');
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
      email,
      roles,
    },
  });
  return updatedUser;
};
