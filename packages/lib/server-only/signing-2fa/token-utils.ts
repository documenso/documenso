import crypto from 'crypto';

const TOKEN_LENGTH = 6;
const SALT_LENGTH = 32;
const HASH_ITERATIONS = 100000;
const HASH_KEY_LENGTH = 64;
const HASH_DIGEST = 'sha512';

export const generateSigningTwoFactorToken = (): string => {
  const bytes = crypto.randomBytes(4);
  const num = bytes.readUInt32BE(0) % 10 ** TOKEN_LENGTH;

  return num.toString().padStart(TOKEN_LENGTH, '0');
};

export const generateTokenSalt = (): string => {
  return crypto.randomBytes(SALT_LENGTH).toString('hex');
};

export const hashToken = (token: string, salt: string): string => {
  return crypto
    .pbkdf2Sync(token, salt, HASH_ITERATIONS, HASH_KEY_LENGTH, HASH_DIGEST)
    .toString('hex');
};

export const verifyTokenHash = (token: string, salt: string, expectedHash: string): boolean => {
  const hash = hashToken(token, salt);

  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(expectedHash, 'hex'));
};
