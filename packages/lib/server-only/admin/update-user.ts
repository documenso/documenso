import { prisma } from '@documenso/prisma';
<<<<<<< HEAD
import { Role } from '@documenso/prisma/client';
=======
import type { Role } from '@documenso/prisma/client';
>>>>>>> main

export type UpdateUserOptions = {
  id: number;
  name: string | null | undefined;
  email: string | undefined;
  roles: Role[] | undefined;
};

export const updateUser = async ({ id, name, email, roles }: UpdateUserOptions) => {
  await prisma.user.findFirstOrThrow({
    where: {
      id,
    },
  });

  return await prisma.user.update({
    where: {
      id,
    },
    data: {
      name,
      email,
      roles,
    },
  });
};
