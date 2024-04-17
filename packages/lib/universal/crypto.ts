import { xchacha20poly1305 } from '@noble/ciphers/chacha';
import { bytesToHex, hexToBytes, utf8ToBytes } from '@noble/ciphers/utils';
import { managedNonce } from '@noble/ciphers/webcrypto/utils';
import { sha256 } from '@noble/hashes/sha256';

export type SymmetricEncryptOptions = {
  key: string;
  data: string;
};

export const symmetricEncrypt = ({ key, data }: SymmetricEncryptOptions) => {
  const keyAsBytes = sha256(key);
  const dataAsBytes = utf8ToBytes(data);

  const chacha = managedNonce(xchacha20poly1305)(keyAsBytes); // manages nonces for you

  return bytesToHex(chacha.encrypt(dataAsBytes));
};

export type SymmetricDecryptOptions = {
  key: string;
  data: string;
};

export const symmetricDecrypt = ({ key, data }: SymmetricDecryptOptions) => {
  const keyAsBytes = sha256(key);
  const dataAsBytes = hexToBytes(data);

  const chacha = managedNonce(xchacha20poly1305)(keyAsBytes); // manages nonces for you

  return chacha.decrypt(dataAsBytes);
};
