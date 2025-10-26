import { hmac } from '@noble/hashes/hmac';
import { sha256 } from '@noble/hashes/sha256';
import { createTOTPKeyURI } from 'oslo/otp';

import { DOCUMENSO_ENCRYPTION_KEY } from '../../../constants/crypto';

const ISSUER = 'Documenso Email 2FA';

export type GenerateTwoFactorCredentialsFromEmailOptions = {
  envelopeId: string;
  email: string;
};

/**
 * Generate an encrypted token containing a 6-digit 2FA code for email verification.
 *
 * @param options - The options for generating the token
 * @returns Object containing the token and the 6-digit code
 */
export const generateTwoFactorCredentialsFromEmail = ({
  envelopeId,
  email,
}: GenerateTwoFactorCredentialsFromEmailOptions) => {
  if (!DOCUMENSO_ENCRYPTION_KEY) {
    throw new Error('Missing DOCUMENSO_ENCRYPTION_KEY');
  }

  const identity = `email-2fa|v1|email:${email}|id:${envelopeId}`;

  const secret = hmac(sha256, DOCUMENSO_ENCRYPTION_KEY, identity);

  const uri = createTOTPKeyURI(ISSUER, email, secret);

  return {
    uri,
    secret,
  };
};
