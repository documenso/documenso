import { z } from 'zod';

import { DOCUMENSO_ENCRYPTION_SECONDARY_KEY } from '@documenso/lib/constants/crypto';
import { symmetricEncrypt } from '@documenso/lib/universal/crypto';
import type { TEncryptSecondaryDataMutationSchema } from '@documenso/trpc/server/crypto/schema';

export const ZEncryptedDataSchema = z.object({
  data: z.string(),
  expiresAt: z.number().optional(),
});

export type EncryptDataOptions = {
  data: string;

  /**
   * When the data should no longer be allowed to be decrypted.
   *
   * Leave this empty to never expire the data.
   */
  expiresAt?: number;
};

/**
 * Encrypt the passed in data. This uses the secondary encrypt key for miscellaneous data.
 *
 * @returns The encrypted data.
 */
export const encryptSecondaryData = ({ data, expiresAt }: TEncryptSecondaryDataMutationSchema) => {
  if (!DOCUMENSO_ENCRYPTION_SECONDARY_KEY) {
    throw new Error('Missing encryption key');
  }

  const dataToEncrypt: z.infer<typeof ZEncryptedDataSchema> = {
    data,
    expiresAt,
  };

  return symmetricEncrypt({
    key: DOCUMENSO_ENCRYPTION_SECONDARY_KEY,
    data: JSON.stringify(dataToEncrypt),
  });
};
