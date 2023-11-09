import * as z from 'zod';

import { User } from '@documenso/prisma/client';

import { decryptSymmetric, getEncryptionKey } from '../../universal/crypto';

interface getBackupCodesParams {
  user: User;
}

const ZBackupCodeSchema = z.array(z.string());

export const getBackupCodes = ({ user }: getBackupCodesParams) => {
  const encryptionKey = getEncryptionKey();

  if (user?.twoFactorBackupCodes) {
    const codes = JSON.parse(
      decryptSymmetric({
        encryptedData: user.twoFactorBackupCodes,
        key: encryptionKey,
      }),
    );

    return ZBackupCodeSchema.parse(codes);
  }

  return null;
};
