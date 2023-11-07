import { compare } from 'bcrypt';
import { decodeBase32 } from 'oslo/encoding';
import { TOTPController } from 'oslo/otp';

import { prisma } from '@documenso/prisma';
import { User } from '@documenso/prisma/client';

import { ErrorCode } from '../../next-auth/error-codes';
import { decryptSymmetric } from '../../universal/crypto';

type disableTwoFactorAuthenticationProps = {
  user: User;
  code?: string;
  password: string;
};

export const disableTwoFactorAuthentication = async ({
  code,
  user,
  password,
}: disableTwoFactorAuthenticationProps) => {
  const encryptionKey = process.env.DOCUMENSO_ENCRYPTION_KEY;

  if (!encryptionKey) {
    throw new Error(ErrorCode.INTERNAL_SEVER_ERROR);
  }

  if (user.identityProvider !== 'DOCUMENSO') {
    throw new Error(ErrorCode.CREDENTIALS_NOT_FOUND);
  }

  if (!user.password) {
    throw new Error(ErrorCode.USER_MISSING_PASSWORD);
  }

  const isCorrectPassword = await compare(password, user.password);

  if (!isCorrectPassword) {
    throw new Error(ErrorCode.INCORRECT_EMAIL_PASSWORD);
  }

  if (!user.twoFactorEnabled) {
    throw new Error(ErrorCode.TWO_FACTOR_SETUP_REQUIRED);
  }

  if (!user.twoFactorSecret) {
    throw new Error(ErrorCode.TWO_FACTOR_SETUP_REQUIRED);
  }

  if (code) {
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
        twoFactorEnabled: false,
        twoFactorBackupCodes: null,
        twoFactorSecret: null,
      },
    });

    return { message: '2fa disabled successfully' };
  }

  throw new Error(ErrorCode.CREDENTIALS_NOT_FOUND);
};
