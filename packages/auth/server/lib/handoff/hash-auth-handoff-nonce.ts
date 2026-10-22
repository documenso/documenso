import { sha256 } from '@oslojs/crypto/sha2';
import { encodeHexLowerCase } from '@oslojs/encoding';
import { z } from 'zod';

export const ZAuthHandoffNonceSchema = z.string().uuid();

export const hashAuthHandoffNonce = (nonce: string): string => {
  return encodeHexLowerCase(sha256(new TextEncoder().encode(nonce)));
};
