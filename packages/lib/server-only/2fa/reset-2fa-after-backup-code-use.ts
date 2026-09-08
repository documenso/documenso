import { prisma } from '@documenso/prisma';
import type { Prisma, User } from '@prisma/client';
import { UserSecurityAuditLogType } from '@prisma/client';

import { AppError } from '../../errors/app-error';
import type { RequestMetadata } from '../../universal/extract-request-metadata';

type ResetTwoFactorAfterBackupCodeUseOptions = {
  /**
   * The user whose backup code was just validated. `twoFactorBackupCodes`
   * must be the exact stored value the code was validated against.
   */
  user: Pick<User, 'id' | 'twoFactorBackupCodes'>;
  requestMetadata?: RequestMetadata;

  /**
   * Optional transaction client so callers (e.g. the 2FA challenge endpoint)
   * can run the recovery reset atomically with their own writes, such as
   * challenge token consumption. When omitted a dedicated transaction is
   * used.
   */
  tx?: Prisma.TransactionClient;
};

/**
 * Backup codes are recovery, not sign-in: a successful backup-code sign-in
 * proves the authenticator is unavailable, so the user's 2FA configuration is
 * atomically reset and they are sent to re-enrol.
 *
 * The conditional update requires 2FA to still be enabled with the exact
 * backup-code state the code was validated against, so concurrent uses cannot
 * double-spend — the loser of the race fails the count check and the sign-in
 * is rejected.
 *
 * Audit trail: reuses `AUTH_2FA_DISABLE` — the effect on the account is
 * identical to a disable. (A dedicated enum value would require a migration;
 * the plan only mandates a new value for the admin reset in a later step.)
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
