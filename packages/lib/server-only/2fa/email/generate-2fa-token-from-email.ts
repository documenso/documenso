import { generateHOTP } from 'oslo/otp';

import { generateTwoFactorCredentialsFromEmail } from './generate-2fa-credentials-from-email';

export type GenerateTwoFactorTokenFromEmailOptions = {
  envelopeId: string;
  email: string;
  period?: number;
};

export const generateTwoFactorTokenFromEmail = async ({
  email,
  envelopeId,
  period = 30_000,
}: GenerateTwoFactorTokenFromEmailOptions) => {
  const { secret } = generateTwoFactorCredentialsFromEmail({ email, envelopeId });

  const counter = Math.floor(Date.now() / period);

  const token = await generateHOTP(secret, counter);

  return token;
};
