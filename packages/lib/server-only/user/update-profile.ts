import { UserSecurityAuditLogType } from '@prisma/client';

import { prisma } from '@documenso/prisma';

import type { RequestMetadata } from '../../universal/extract-request-metadata';

export type UpdateProfileOptions = {
  userId: number;
  name: string;
  signature: string;
  requestMetadata?: RequestMetadata;
};

export const updateProfile = async ({
  userId,
  name,
  signature,
  requestMetadata,
}: UpdateProfileOptions) => {
  // Existence check
  await prisma.user.findFirstOrThrow({
    where: {
      id: userId,
    },
  });

  await prisma.$transaction(async (tx) => {
    await tx.userSecurityAuditLog.create({
      data: {
        userId,
        type: UserSecurityAuditLogType.ACCOUNT_PROFILE_UPDATE,
        userAgent: requestMetadata?.userAgent,
        ipAddress: requestMetadata?.ipAddress,
      },
    });

    await tx.user.update({
      where: {
        id: userId,
      },
      data: {
        name,
        signature,
      },
    });
  });
};
