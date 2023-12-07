import { z } from 'zod';

import { User } from '@documenso/prisma/client';

import { DOCUMENSO_ENCRYPTION_KEY } from '../../constants/crypto';
import { symmetricDecrypt } from '../../universal/crypto';

interface GetBackupCodesOptions {
  user: User;
}

const ZBackupCodeSchema = z.array(z.string());

export const getBackupCodes = ({ user }: GetBackupCodesOptions) => {
  const key = DOCUMENSO_ENCRYPTION_KEY;

  if (!user.twoFactorEnabled) {
    throw new Error('User has not enabled 2FA');
  }

  if (!user.twoFactorBackupCodes) {
    throw new Error('User has no backup codes');
  }

  const secret = Buffer.from(symmetricDecrypt({ key, data: user.twoFactorBackupCodes })).toString(
    'utf-8',
  );

  const data = JSON.parse(secret);

  const result = ZBackupCodeSchema.safeParse(data);

  if (result.success) {
    return result.data;
  }

  return null;
};
