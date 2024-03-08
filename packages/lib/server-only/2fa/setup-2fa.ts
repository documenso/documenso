import { compare } from '@node-rs/bcrypt';
import { base32 } from '@scure/base';
import crypto from 'crypto';
import { createTOTPKeyURI } from 'oslo/otp';

import { ErrorCode } from '@documenso/lib/next-auth/error-codes';
import { prisma } from '@documenso/prisma';
import { type User } from '@documenso/prisma/client';

import { DOCUMENSO_ENCRYPTION_KEY } from '../../constants/crypto';
import { symmetricEncrypt } from '../../universal/crypto';

type SetupTwoFactorAuthenticationOptions = {
  user: User;
  password: string;
};

const ISSUER = 'Documenso';

export const setupTwoFactorAuthentication = async ({
  user,
  password,
}: SetupTwoFactorAuthenticationOptions) => {
  const key = DOCUMENSO_ENCRYPTION_KEY;

  if (!key) {
    throw new Error(ErrorCode.MISSING_ENCRYPTION_KEY);
  }

  if (user.identityProvider !== 'DOCUMENSO') {
    throw new Error(ErrorCode.INCORRECT_IDENTITY_PROVIDER);
  }

  if (!user.password) {
    throw new Error(ErrorCode.USER_MISSING_PASSWORD);
  }

  const isCorrectPassword = await compare(password, user.password);

  if (!isCorrectPassword) {
    throw new Error(ErrorCode.INCORRECT_PASSWORD);
  }

  const secret = crypto.randomBytes(10);

  const backupCodes = Array.from({ length: 10 })
    .fill(null)
    .map(() => crypto.randomBytes(5).toString('hex'))
    .map((code) => `${code.slice(0, 5)}-${code.slice(5)}`.toUpperCase());

  const accountName = user.email;
  const uri = createTOTPKeyURI(ISSUER, accountName, secret);
  const encodedSecret = base32.encode(secret);

  await prisma.user.update({
    where: {
      id: user.id,
    },
    data: {
      twoFactorEnabled: false,
      twoFactorBackupCodes: symmetricEncrypt({
        data: JSON.stringify(backupCodes),
        key: key,
      }),
      twoFactorSecret: symmetricEncrypt({
        data: encodedSecret,
        key: key,
      }),
    },
  });

  return {
    secret: encodedSecret,
    uri,
  };
};
