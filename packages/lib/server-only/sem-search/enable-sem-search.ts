import { ErrorCode } from '@documenso/lib/next-auth/error-codes';
import { prisma } from '@documenso/prisma';
import { User } from '@documenso/prisma/client';

export const enableSemSearch = async (user: User) => {
  if (user.identityProvider !== 'DOCUMENSO') {
    throw new Error(ErrorCode.INCORRECT_IDENTITY_PROVIDER);
  }

  if (user.semSearchEnabled) {
    throw new Error(ErrorCode.SEM_SEARCH_ALREADY_ENABLED);
  }

  const updatedUser = await prisma.user.update({
    where: {
      id: user.id,
    },
    data: {
      semSearchEnabled: true,
    },
  });
};
