import { AdminRuleEngine } from '@documenso/ee/server-only/admin-rules/admin-rule-engine';
import { prisma } from '@documenso/prisma';
import { UserSecurityAuditLogType } from '@prisma/client';
import type { ApiRequestMetadata } from '../../universal/extract-request-metadata';

export type UpdateProfileOptions = {
  userId: number;
  name: string;
  signature: string;
  requestMetadata?: ApiRequestMetadata;
};

export const updateProfile = async ({ userId, name, signature, requestMetadata }: UpdateProfileOptions) => {
  const user = await prisma.user.findFirstOrThrow({
    where: {
      id: userId,
    },
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
      twoFactorEnabled: true,
    },
  });

  if (user.name !== name) {
    const adminRuleEngine = new AdminRuleEngine({
      requestMetadata: requestMetadata?.requestMetadata,
      requestSource: requestMetadata?.source,
    });

    await adminRuleEngine.runAndAssert({
      trigger: 'USER_NAME_CHANGED',
      user,
      newName: name,
    });
  }

  await prisma.$transaction(async (tx) => {
    await tx.userSecurityAuditLog.create({
      data: {
        userId,
        type: UserSecurityAuditLogType.ACCOUNT_PROFILE_UPDATE,
        userAgent: requestMetadata?.requestMetadata.userAgent,
        ipAddress: requestMetadata?.requestMetadata.ipAddress,
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
