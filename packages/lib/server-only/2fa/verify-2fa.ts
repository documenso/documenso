import { decodeBase32 } from 'oslo/encoding';
import { TOTPController } from 'oslo/otp';

import { User } from '@documenso/prisma/client';

import { decryptSymmetric, getEncryptionKey } from '../../universal/crypto';

type verifyTwoFactorParams = {
  user: User;
  totpCode: string;
};

export const verifyTwoFactor = async ({ user, totpCode }: verifyTwoFactorParams) => {
  const encryptionKey = getEncryptionKey();

  if (!user.twoFactorSecret) {
    throw new Error('user missing 2fa secret');
  }

  const secret = decryptSymmetric({ encryptedData: user.twoFactorSecret, key: encryptionKey });

  const otpController = new TOTPController();

  const isValidToken = await otpController.verify(totpCode, decodeBase32(secret));

  return isValidToken;
};
