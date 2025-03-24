import { DocumentStatus } from '@prisma/client';

import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { deletedAccountServiceAccount } from './service-accounts/deleted-account';

export type DeleteUserOptions = {
  id: number;
};

export const deleteUser = async ({ id }: DeleteUserOptions) => {
  const user = await prisma.user.findFirst({
    where: {
      id,
    },
  });

  if (!user) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: `User with ID ${id} not found`,
    });
  }

  const serviceAccount = await deletedAccountServiceAccount();

  // TODO: Send out cancellations for all pending docs
  await prisma.document.updateMany({
    where: {
      userId: user.id,
      status: {
        in: [DocumentStatus.PENDING, DocumentStatus.REJECTED, DocumentStatus.COMPLETED],
      },
    },
    data: {
      userId: serviceAccount.id,
      deletedAt: new Date(),
    },
  });

  return await prisma.user.delete({
    where: {
      id: user.id,
    },
  });
};
