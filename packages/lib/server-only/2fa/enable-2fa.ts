import { ErrorCode } from '@documenso/lib/next-auth/error-codes';
import { prisma } from '@documenso/prisma';
import { User } from '@documenso/prisma/client';

import { getBackupCodes } from './get-backup-code';
import { verifyTwoFactorAuthenticationToken } from './verify-2fa-token';

type EnableTwoFactorAuthenticationOptions = {
  user: User;
  code: string;
};

export const enableTwoFactorAuthentication = async ({
  user,
  code,
}: EnableTwoFactorAuthenticationOptions) => {
  if (user.identityProvider !== 'DOCUMENSO') {
    throw new Error(ErrorCode.INCORRECT_IDENTITY_PROVIDER);
  }

  if (user.twoFactorEnabled) {
    throw new Error(ErrorCode.TWO_FACTOR_ALREADY_ENABLED);
  }

  if (!user.twoFactorSecret) {
    throw new Error(ErrorCode.TWO_FACTOR_SETUP_REQUIRED);
  }

  const isValidToken = await verifyTwoFactorAuthenticationToken({ user, totpCode: code });

  if (!isValidToken) {
    throw new Error(ErrorCode.INCORRECT_TWO_FACTOR_CODE);
  }

  const updatedUser = await prisma.user.update({
    where: {
      id: user.id,
    },
    data: {
      twoFactorEnabled: true,
    },
  });

  const recoveryCodes = getBackupCodes({ user: updatedUser });

  return { recoveryCodes };
};
