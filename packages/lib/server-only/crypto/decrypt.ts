import { DOKU_SEAL_ENCRYPTION_SECONDARY_KEY } from '@doku-seal/lib/constants/crypto';
import { ZEncryptedDataSchema } from '@doku-seal/lib/server-only/crypto/encrypt';
import { symmetricDecrypt } from '@doku-seal/lib/universal/crypto';

/**
 * Decrypt the passed in data. This uses the secondary encrypt key for miscellaneous data.
 *
 * @param encryptedData The data encrypted with the `encryptSecondaryData` function.
 * @returns The decrypted value, or `null` if the data is invalid or expired.
 */
export const decryptSecondaryData = (encryptedData: string): string | null => {
  if (!DOKU_SEAL_ENCRYPTION_SECONDARY_KEY) {
    throw new Error('Missing encryption key');
  }

  try {
    const decryptedBufferValue = symmetricDecrypt({
      key: DOKU_SEAL_ENCRYPTION_SECONDARY_KEY,
      data: encryptedData,
    });

    const decryptedValue = Buffer.from(decryptedBufferValue).toString('utf-8');
    const result = ZEncryptedDataSchema.safeParse(JSON.parse(decryptedValue));

    if (!result.success) {
      return null;
    }

    if (result.data.expiresAt !== undefined && result.data.expiresAt < Date.now()) {
      return null;
    }

    return result.data.data;
  } catch {
    return null;
  }
};
