import { prisma } from '@documenso/prisma';
import { DocumentStatus } from '@documenso/prisma/client';

export type DeleteUserOptions = {
  email: string;
};

export const deletedServiceAccount = async ({ email }: DeleteUserOptions) => {
  const user = await prisma.user.findFirst({
    where: {
      email: {
        contains: email,
      },
    },
  });

  const defaultDeleteUser = await prisma.user.findFirst({
    where: {
      email: 'deleted@documenso.com',
    },
  });

  if (!user) {
    throw new Error(`User with email ${email} not found`);
  }

  if (!defaultDeleteUser) {
    throw new Error(`Default delete account not found`);
  }

  await prisma.document.updateMany({
    where: {
      userId: user.id,
      status: {
        in: [DocumentStatus.PENDING, DocumentStatus.COMPLETED],
      },
    },
    data: {
      userId: defaultDeleteUser.id,
      deletedAt: new Date(),
    },
  });

  return await prisma.user.delete({
    where: {
      id: user.id,
    },
  });
};
