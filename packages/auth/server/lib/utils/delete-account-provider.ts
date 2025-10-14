import { UserSecurityAuditLogType } from '@prisma/client';
import type { Context } from 'hono';

import { ORGANISATION_USER_ACCOUNT_TYPE } from '@documenso/lib/constants/organisations';
import { prisma } from '@documenso/prisma';

import { getSession } from './get-session';

export const deleteAccountProvider = async (c: Context, accountId: string): Promise<void> => {
  const { user } = await getSession(c);

  const requestMeta = c.get('requestMetadata');

  await prisma.$transaction(async (tx) => {
    const deletedAccountProvider = await tx.account.delete({
      where: {
        id: accountId,
        userId: user.id,
      },
      select: {
        type: true,
      },
    });

    await tx.userSecurityAuditLog.create({
      data: {
        userId: user.id,
        ipAddress: requestMeta.ipAddress,
        userAgent: requestMeta.userAgent,
        type:
          deletedAccountProvider.type === ORGANISATION_USER_ACCOUNT_TYPE
            ? UserSecurityAuditLogType.ORGANISATION_SSO_UNLINK
            : UserSecurityAuditLogType.ACCOUNT_SSO_UNLINK,
      },
    });
  });
};
