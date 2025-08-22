import { compare } from '@node-rs/bcrypt';

import { prisma } from '@documenso/prisma';

type VerifyPasswordOptions = {
  userId: number;
  password: string;
};

export const verifyPassword = async ({ userId, password }: VerifyPasswordOptions) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user || !user.password) {
    return false;
  }

  return await compare(password, user.password);
};
