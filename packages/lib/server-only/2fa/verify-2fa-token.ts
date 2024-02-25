import { base32 } from '@scure/base';
import { TOTPController } from 'oslo/otp';

import type { User } from '@documenso/prisma/client';

import { DOCUMENSO_ENCRYPTION_KEY } from '../../constants/crypto';
import { symmetricDecrypt } from '../../universal/crypto';

const totp = new TOTPController();

type VerifyTwoFactorAuthenticationTokenOptions = {
  user: User;
  totpCode: string;
};

export const verifyTwoFactorAuthenticationToken = async ({
  user,
  totpCode,
}: VerifyTwoFactorAuthenticationTokenOptions) => {
  const key = DOCUMENSO_ENCRYPTION_KEY;

  if (!user.twoFactorSecret) {
    throw new Error('user missing 2fa secret');
  }

  const secret = Buffer.from(symmetricDecrypt({ key, data: user.twoFactorSecret })).toString(
    'utf-8',
  );

  const isValidToken = await totp.verify(totpCode, base32.decode(secret));

  return isValidToken;
};
