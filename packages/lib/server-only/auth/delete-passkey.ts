import { UserSecurityAuditLogType } from '@prisma/client';

import { prisma } from '@documenso/prisma';

import type { RequestMetadata } from '../../universal/extract-request-metadata';

export interface DeletePasskeyOptions {
  userId: number;
  passkeyId: string;
  requestMetadata?: RequestMetadata;
}

export const deletePasskey = async ({
  userId,
  passkeyId,
  requestMetadata,
}: DeletePasskeyOptions) => {
  await prisma.passkey.findFirstOrThrow({
    where: {
      id: passkeyId,
      userId,
    },
  });

  await prisma.$transaction(async (tx) => {
    await tx.passkey.delete({
      where: {
        id: passkeyId,
        userId,
      },
    });

    await tx.userSecurityAuditLog.create({
      data: {
        userId,
        type: UserSecurityAuditLogType.PASSKEY_DELETED,
        userAgent: requestMetadata?.userAgent,
        ipAddress: requestMetadata?.ipAddress,
      },
    });
  });
};
