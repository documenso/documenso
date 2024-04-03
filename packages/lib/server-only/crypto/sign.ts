import { hashString } from '../auth/hash';
import { encryptSecondaryData } from './encrypt';

export const sign = (data: unknown) => {
  const stringified = JSON.stringify(data);

  const hashed = hashString(stringified);

  const signature = encryptSecondaryData({ data: hashed });

  return signature;
};
