import { prisma } from '@documenso/prisma';
import { Role } from '@documenso/prisma/client';

export type UpdateUserOptions = {
  id: number;
  name: string;
  email: string;
  roles: Role[];
};

export const updateUser = async ({ id, name, email, roles }: UpdateUserOptions) => {
  console.log('wtf');
  await prisma.user.findFirstOrThrow({
    where: {
      id,
    },
  });

  const updatedUser = await prisma.user.update({
    where: {
      id,
    },
    data: {
      name,
      email,
      roles,
    },
  });
  return updatedUser;
};
