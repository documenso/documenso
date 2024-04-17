import { prisma } from '@documenso/prisma';
<<<<<<< HEAD
=======
import { UserSecurityAuditLogType } from '@documenso/prisma/client';

import type { RequestMetadata } from '../../universal/extract-request-metadata';
>>>>>>> main

export type UpdateProfileOptions = {
  userId: number;
  name: string;
  signature: string;
<<<<<<< HEAD
};

export const updateProfile = async ({ userId, name, signature }: UpdateProfileOptions) => {
=======
  requestMetadata?: RequestMetadata;
};

export const updateProfile = async ({
  userId,
  name,
  signature,
  requestMetadata,
}: UpdateProfileOptions) => {
>>>>>>> main
  // Existence check
  await prisma.user.findFirstOrThrow({
    where: {
      id: userId,
    },
  });

<<<<<<< HEAD
  const updatedUser = await prisma.user.update({
    where: {
      id: userId,
    },
    data: {
      name,
      signature,
    },
  });

  return updatedUser;
=======
  return await prisma.$transaction(async (tx) => {
    await tx.userSecurityAuditLog.create({
      data: {
        userId,
        type: UserSecurityAuditLogType.ACCOUNT_PROFILE_UPDATE,
        userAgent: requestMetadata?.userAgent,
        ipAddress: requestMetadata?.ipAddress,
      },
    });

    return await tx.user.update({
      where: {
        id: userId,
      },
      data: {
        name,
        signature,
      },
    });
  });
>>>>>>> main
};
