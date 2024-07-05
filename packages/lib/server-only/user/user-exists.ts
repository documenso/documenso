import { prisma } from '@documenso/prisma';

export type UserExistsOptions = {
  email: string;
};

export const userExists = async ({ email }: UserExistsOptions) => {
  return await prisma.user.findUnique({
    where: {
      email,
    },
    select: {
      id: true,
    },
  });
};
