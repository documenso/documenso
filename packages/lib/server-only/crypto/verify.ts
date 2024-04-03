import { hashString } from '../auth/hash';
import { decryptSecondaryData } from './decrypt';

export const verify = (data: unknown, signature: string) => {
  const stringified = JSON.stringify(data);

  const hashed = hashString(stringified);

  const decrypted = decryptSecondaryData(signature);

  return decrypted === hashed;
};
