import { TRPCError } from '@trpc/server';
import { compare } from 'bcrypt';
import crypto from 'crypto';
import { encodeBase32 } from 'oslo/encoding';
import { createTOTPKeyURI } from 'oslo/otp';
import qrcode from 'qrcode';

import { ErrorCode } from '@documenso/lib/next-auth/error-codes';
import { prisma } from '@documenso/prisma';
import { User } from '@documenso/prisma/client';

import { encryptSymmetric } from '../../universal/crypto';

type setupTwoFactorAuthenticationOptions = {
  user: User;
  password: string;
};

const ISSUER = 'Notario';

const formatBackupCode = (code: string) => `${code.slice(0, 5)}-${code.slice(5, 10)}`;

export const setupTwoFactorAuthentication = async ({
  user,
  password,
}: setupTwoFactorAuthenticationOptions) => {
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

  if (!user.password) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: ErrorCode.USER_MISSING_PASSWORD,
    });
  }
  const isCorrectPassword = await compare(password, user.password);

  if (!isCorrectPassword) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: ErrorCode.INCORRECT_PASSWORD,
    });
  }

  const secret = crypto.randomBytes(10);
  const backupCodes = Array.from(Array(10), () => crypto.randomBytes(5).toString('hex')).map(
    formatBackupCode,
  );

  const accountName = user.email;
  const uri = createTOTPKeyURI(ISSUER, accountName, secret);
  const qr = await qrcode.toDataURL(uri);
  const twoFactorSecret = encodeBase32(secret, { padding: false });

  await prisma.user.update({
    where: {
      id: user.id,
    },
    data: {
      twoFactorBackupCodes: encryptSymmetric({
        data: JSON.stringify(backupCodes),
        key: encryptionKey,
      }),
      twoFactorEnabled: false,
      twoFactorSecret: encryptSymmetric({
        data: twoFactorSecret,
        key: encryptionKey,
      }),
    },
  });

  return {
    secret: twoFactorSecret,
    uri,
    qr,
  };
};
