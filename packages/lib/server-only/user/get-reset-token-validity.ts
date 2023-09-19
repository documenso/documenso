import { prisma } from '@documenso/prisma';

type GetResetTokenValidityOptions = {
  token: string;
};

export const getResetTokenValidity = async ({ token }: GetResetTokenValidityOptions) => {
  const found = await prisma.passwordResetToken.findFirst({
    select: {
      id: true,
    },
    where: {
      token,
    },
  });

  return !!found;
};
