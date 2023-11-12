import crypto from 'crypto';

import { DOCUMENSO_ENCRYPTION_KEY } from '../constants/crypto';

const ALGORITHM = 'aes-256-gcm';
const INPUT_ENCODING = 'utf8';
const OUTPUT_ENCODING = 'hex';
const BLOCK_SIZE_BYTES = 16;

type encryptSymmetricOptions = {
  data: string;
  key: string;
};

export const getEncryptionKey = () => {
  const encryptionKey = DOCUMENSO_ENCRYPTION_KEY;

  if (!encryptionKey) {
    throw new Error('Missing encryption key');
  }
  return encryptionKey;
};

export const encryptSymmetric = ({ key, data }: encryptSymmetricOptions) => {
  const iv = crypto.randomBytes(BLOCK_SIZE_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(key), iv);

  let encryptedData = cipher.update(data, INPUT_ENCODING, OUTPUT_ENCODING);
  encryptedData += cipher.final(OUTPUT_ENCODING);

  const authenticationTag = cipher.getAuthTag().toString(OUTPUT_ENCODING);

  const serializedData = `${iv.toString(OUTPUT_ENCODING)}:${encryptedData}:${authenticationTag}`;

  return serializedData;
};

type decryptSymmetricOptions = {
  encryptedData: string;
  key: string;
};

export const decryptSymmetric = ({ encryptedData, key }: decryptSymmetricOptions) => {
  const [ivHex, encryptedDataHex, authTagHex] = encryptedData.split(':');

  const iv = Buffer.from(ivHex, OUTPUT_ENCODING);
  const authTag = Buffer.from(authTagHex, OUTPUT_ENCODING);

  const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(key), iv);
  decipher.setAuthTag(authTag);

  let decryptedData = decipher.update(encryptedDataHex, OUTPUT_ENCODING, INPUT_ENCODING);
  decryptedData += decipher.final(INPUT_ENCODING);

  return decryptedData;
};
