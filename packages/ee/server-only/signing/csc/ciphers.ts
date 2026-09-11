import { symmetricDecrypt, symmetricEncrypt } from '@documenso/lib/universal/crypto';
import { requireEnv } from '@documenso/lib/utils/env';
import { bytesToHex, hexToBytes } from '@noble/ciphers/utils';

/**
 * Bytes-based wrappers around {@link symmetricEncrypt} / {@link symmetricDecrypt}
 * for the two CSC secrets stored on Prisma `Bytes` columns:
 *
 * - `CscCredential.serviceTokenCiphertext` — service-scope OAuth access token.
 * - `CscSession.encryptedSad` — credential-scope SAD.
 *
 * Both use the primary `DOCUMENSO_ENCRYPTION_KEY` (same key family as 2FA
 * secrets, OIDC client secrets, DKIM private keys). The underlying cipher
 * returns hex; we round-trip through `bytesToHex` / `hexToBytes` so the
 * persisted bytes are the raw XChaCha20-Poly1305 ciphertext (nonce + tag +
 * payload), not a hex-string-as-bytes inflation.
 */

/**
 * Encrypt a CSC plaintext secret (service token or SAD) for persistence.
 * Throws `MISSING_ENV_VAR` on missing encryption key — encryption can't
 * otherwise fail.
 */
export const encryptCscToken = (plaintext: string): Uint8Array => {
  const key = requireEnv('NEXT_PRIVATE_ENCRYPTION_KEY');

  const hex = symmetricEncrypt({ key, data: plaintext });

  return hexToBytes(hex);
};

/**
 * Decrypt a CSC ciphertext back to its UTF-8 plaintext. Returns `null` on
 * any cipher-level failure (key rotation, payload tamper, row corruption)
 * so the caller can map to a domain-appropriate AppError — typically
 * re-auth for service tokens, `CSC_SAD_EXPIRED_PRE_SIGN` for SADs.
 *
 * A missing key throws (config error, must surface loudly) and is *not*
 * folded into the null return.
 */
export const decryptCscToken = (ciphertext: Uint8Array): string | null => {
  const key = requireEnv('NEXT_PRIVATE_ENCRYPTION_KEY');

  try {
    const buf = symmetricDecrypt({ key, data: bytesToHex(ciphertext) });

    return Buffer.from(buf).toString('utf-8');
  } catch {
    return null;
  }
};
