import { hmac } from '@noble/hashes/hmac';
import { sha256 } from '@noble/hashes/sha256';
import { generateHOTP } from 'oslo/otp';

import { DOCUMENSO_ENCRYPTION_KEY } from '../../constants/crypto';

const PERIOD_MS = 60_000;

/**
 * The number of periods a code stays valid after it is issued, so about 10 minutes.
 */
const WINDOW = 10;

type External2FACodeOptions = {
  envelopeId: string;
  recipientId: number;
};

/**
 * Generate the current external 2FA code for a recipient.
 *
 * The code is derived from the recipient and the encryption key, so nothing is stored.
 * Calls in the same period return the same code.
 */
export const generateExternal2FACode = async (options: External2FACodeOptions) => {
  const counter = Math.floor(Date.now() / PERIOD_MS);

  return {
    code: await generateHOTP(getSecret(options), counter),
    expiresAt: new Date((counter + WINDOW) * PERIOD_MS),
  };
};

export const validateExternal2FACode = async ({ code, ...options }: External2FACodeOptions & { code: string }) => {
  const secret = getSecret(options);
  const counter = Math.floor(Date.now() / PERIOD_MS);

  for (let i = 0; i < WINDOW; i++) {
    if ((await generateHOTP(secret, counter - i)) === code) {
      return true;
    }
  }

  return false;
};

const getSecret = ({ envelopeId, recipientId }: External2FACodeOptions) => {
  if (!DOCUMENSO_ENCRYPTION_KEY) {
    throw new Error('Missing DOCUMENSO_ENCRYPTION_KEY');
  }

  return hmac(sha256, DOCUMENSO_ENCRYPTION_KEY, `external-2fa|v1|recipient:${recipientId}|id:${envelopeId}`);
};
