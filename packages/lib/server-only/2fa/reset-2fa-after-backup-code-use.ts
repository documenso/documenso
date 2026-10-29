import { prisma } from '@documenso/prisma';
import type { Prisma, User } from '@prisma/client';
import { UserSecurityAuditLogType } from '@prisma/client';

import { AppError } from '../../errors/app-error';
import type { RequestMetadata } from '../../universal/extract-request-metadata';

type ResetTwoFactorAfterBackupCodeUseOptions = {
  /**
   * `twoFactorBackupCodes` must be the exact stored value the code was
   * validated against.
   */
  user: Pick<User, 'id' | 'twoFactorBackupCodes'>;
  requestMetadata?: RequestMetadata;
  tx?: Prisma.TransactionClient;
};

/**
 * Backup codes are recovery, not sign-in: using one proves the authenticator is
 * unavailable, so 2FA is reset and the user re-enrols.
 *
 * The conditional update requires the exact backup-code state the code was
 * validated against, so concurrent uses cannot double-spend.
 */
export const resetTwoFactorAfterBackupCodeUse = async ({
  user,
  requestMetadata,
  tx,
}: ResetTwoFactorAfterBackupCodeUseOptions) => {
  const run = async (client: Prisma.TransactionClient) => {
    const { count } = await client.user.updateMany({
      where: {
        id: user.id,
        twoFactorEnabled: true,
        twoFactorBackupCodes: user.twoFactorBackupCodes,
      },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorBackupCodes: null,
      },
    });

    if (count === 0) {
      throw new AppError('INCORRECT_TWO_FACTOR_CODE', {
        message: 'The backup code has already been consumed.',
        statusCode: 400,
      });
    }

    await client.userSecurityAuditLog.create({
      data: {
        userId: user.id,
        type: UserSecurityAuditLogType.AUTH_2FA_DISABLE,
        userAgent: requestMetadata?.userAgent,
        ipAddress: requestMetadata?.ipAddress,
      },
    });
  };

  if (tx) {
    await run(tx);

    return;
  }

  await prisma.$transaction(run);
};
