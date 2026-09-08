import { prisma } from '@documenso/prisma';
import type { User } from '@prisma/client';
import { UserSecurityAuditLogType } from '@prisma/client';

import { AppError, AppErrorCode } from '../../errors/app-error';
import type { RequestMetadata } from '../../universal/extract-request-metadata';
import { getInstanceTwoFactorEnforcementSetting } from './get-instance-two-factor-enforcement-setting';
import { validateTwoFactorAuthentication } from './validate-2fa';

type DisableTwoFactorAuthenticationOptions = {
  user: Pick<User, 'id' | 'email' | 'twoFactorEnabled' | 'twoFactorSecret' | 'twoFactorBackupCodes'>;
  totpCode?: string;
  backupCode?: string;
  requestMetadata?: RequestMetadata;
};

export const disableTwoFactorAuthentication = async ({
  totpCode,
  backupCode,
  user,
  requestMetadata,
}: DisableTwoFactorAuthenticationOptions) => {
  if (!totpCode && !backupCode) {
    throw new AppError(AppErrorCode.INVALID_REQUEST);
  }

  // Disabling always breaks enforcement satisfaction (a passkey sign-in never
  // substitutes for enrolment), so while instance-wide enforcement is active
  // disabling is a straight path to being blocked — refuse it outright.
  const instanceEnforcementSetting = await getInstanceTwoFactorEnforcementSetting();

  if (instanceEnforcementSetting !== null) {
    throw new AppError('TWO_FACTOR_DISABLE_FORBIDDEN', {
      message: 'Two-factor authentication cannot be disabled while it is required by this instance.',
      statusCode: 403,
    });
  }

  const { isValid } = await validateTwoFactorAuthentication({ totpCode, backupCode, user });

  if (!isValid) {
    throw new AppError('INCORRECT_TWO_FACTOR_CODE');
  }

  // Org-only enforcement allows the disable (the rest of the app stays
  // usable) but the caller should warn that org/team context access blocks at
  // the org deadline — immediately if it is already past.
  const orgEnforcementCount = await prisma.organisationMember.count({
    where: {
      userId: user.id,
      organisation: {
        organisationGlobalSettings: {
          twoFactorRequired: true,
        },
      },
    },
  });

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: {
        id: user.id,
      },
      data: {
        twoFactorEnabled: false,
        twoFactorBackupCodes: null,
        twoFactorSecret: null,
      },
    });

    await tx.userSecurityAuditLog.create({
      data: {
        userId: user.id,
        type: UserSecurityAuditLogType.AUTH_2FA_DISABLE,
        userAgent: requestMetadata?.userAgent,
        ipAddress: requestMetadata?.ipAddress,
      },
    });
  });

  return { orgEnforcementApplies: orgEnforcementCount > 0 };
};
