import { decodeBase32 } from 'oslo/encoding';
import { TOTPController } from 'oslo/otp';

import { ErrorCode } from '@documenso/lib/next-auth/error-codes';
import { prisma } from '@documenso/prisma';
import { User } from '@documenso/prisma/client';

import { decryptSymmetric } from '../../universal/crypto';

type enableTwoFactorAuthenticationOptions = {
  user: User;
  code: string;
};

export const enableTwoFactorAuthentication = async ({
  user,
  code,
}: enableTwoFactorAuthenticationOptions) => {
  const encryptionKey = process.env.DOCUMENSO_ENCRYPTION_KEY;

  if (!encryptionKey) {
    throw new Error(ErrorCode.INTERNAL_SEVER_ERROR);
  }

  if (user.identityProvider !== 'DOCUMENSO') {
    throw new Error(ErrorCode.CREDENTIALS_NOT_FOUND);
  }

  if (user.twoFactorEnabled) {
    throw new Error(ErrorCode.TWO_FACTOR_ALREADY_ENABLED);
  }

  if (!user.twoFactorSecret) {
    throw new Error(ErrorCode.TWO_FACTOR_SETUP_REQUIRED);
  }

  const secret = decryptSymmetric({ encryptedData: user.twoFactorSecret, key: encryptionKey });

  const otpController = new TOTPController();

  const isValidToken = await otpController.verify(code, decodeBase32(secret));

  if (!isValidToken) {
    throw new Error(ErrorCode.INCORRECT_TWO_FACTOR_CODE);
  }

  await prisma.user.update({
    where: {
      id: user.id,
    },
    data: {
      twoFactorEnabled: true,
    },
  });

  return { message: '2fa enabled successfully' };
};
