import { compare } from 'bcrypt';
import crypto from 'crypto';
import { HMAC } from 'oslo/crypto';
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

const ISSUER = 'Documenso';

export const setupTwoFactorAuthentication = async ({
  user,
  password,
}: setupTwoFactorAuthenticationOptions) => {
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

  const secret = await new HMAC('SHA-1').generateKey();
  const backupCodes = Array.from(Array(10), () => crypto.randomBytes(5).toString('hex'));

  const accountName = user.email;
  const uri = createTOTPKeyURI(ISSUER, accountName, secret);
  const qr = await qrcode.toDataURL(uri);

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
        data: Buffer.from(secret).toString(),
        key: encryptionKey,
      }),
    },
  });

  return {
    secret,
    uri,
    qr,
  };
};
