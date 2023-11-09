import { TRPCError } from '@trpc/server';

import { ErrorCode } from '@documenso/lib/next-auth/error-codes';
import { prisma } from '@documenso/prisma';
import { User } from '@documenso/prisma/client';

import { verifyTwoFactor } from './verify-2fa';

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
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: ErrorCode.MISSING_ENCRYPTION_KEY,
    });
  }

  if (user.identityProvider !== 'DOCUMENSO') {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: ErrorCode.INCORRECT_IDENTITY_PROVIDER,
    });
  }

  if (user.twoFactorEnabled) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: ErrorCode.TWO_FACTOR_ALREADY_ENABLED,
    });
  }

  if (!user.twoFactorSecret) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: ErrorCode.TWO_FACTOR_SETUP_REQUIRED,
    });
  }

  const isValidToken = await verifyTwoFactor({ user, totpCode: code });

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
      twoFactorEnabled: true,
    },
  });

  return { message: '2fa enabled successfully' };
};
