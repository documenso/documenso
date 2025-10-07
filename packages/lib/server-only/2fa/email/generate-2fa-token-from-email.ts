import { generateHOTP } from 'oslo/otp';

import { generateTwoFactorCredentialsFromEmail } from './generate-2fa-credentials-from-email';

export type GenerateTwoFactorTokenFromEmailOptions = {
  documentId: number;
  email: string;
  period?: number;
};

export const generateTwoFactorTokenFromEmail = async ({
  email,
  documentId,
  period = 30_000,
}: GenerateTwoFactorTokenFromEmailOptions) => {
  const { secret } = generateTwoFactorCredentialsFromEmail({ email, documentId });

  const counter = Math.floor(Date.now() / period);

  const token = await generateHOTP(secret, counter);

  return token;
};
