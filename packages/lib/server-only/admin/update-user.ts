import { prisma } from '@documenso/prisma';
import type { Role } from '@prisma/client';

export type UpdateUserOptions = {
  id: number;
  name: string | null | undefined;
  email: string | undefined;
  roles: Role[] | undefined;
};

export const updateUser = async ({ id, name, email, roles }: UpdateUserOptions) => {
  await prisma.user.update({
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
