import { TRPCError } from '@trpc/server';
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
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: ErrorCode.INTERNAL_SEVER_ERROR,
    });
  }

  if (user.identityProvider !== 'DOCUMENSO') {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: ErrorCode.INCORRECT_IDENTITY_PROVIDER,
    });
  }

  if (!user.password) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: ErrorCode.USER_MISSING_PASSWORD,
    });
  }

  if (!user.twoFactorEnabled) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: ErrorCode.TWO_FACTOR_SETUP_REQUIRED,
    });
  }

  if (!user.twoFactorSecret) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: ErrorCode.TWO_FACTOR_MISSING_SECRET,
    });
  }

  const isCorrectPassword = await compare(password, user.password);

  if (!isCorrectPassword) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: ErrorCode.INCORRECT_PASSWORD,
    });
  }

  if (code) {
    const secret = decryptSymmetric({ encryptedData: user.twoFactorSecret, key: encryptionKey });

    const otpController = new TOTPController();

    const isValidToken = await otpController.verify(code, decodeBase32(secret));

    if (!isValidToken) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: ErrorCode.INCORRECT_TWO_FACTOR_CODE,
      });
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

  throw new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: ErrorCode.INTERNAL_SEVER_ERROR,
  });
};
