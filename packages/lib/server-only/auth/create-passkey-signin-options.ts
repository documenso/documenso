import { prisma } from '@documenso/prisma';
import { generateAuthenticationOptions } from '@simplewebauthn/server';
import { DateTime } from 'luxon';

import { getAuthenticatorOptions } from '../../utils/authenticator';

type CreatePasskeySigninOptions = {
  sessionId: string;
};

export const createPasskeySigninOptions = async ({ sessionId }: CreatePasskeySigninOptions) => {
  const { rpId, timeout } = getAuthenticatorOptions();

  const options = await generateAuthenticationOptions({
    rpID: rpId,
    // A passkey sign-in creates a `twoFactorVerified` session, so user
    // verification (PIN/biometric) is mandatory. Possession alone is a single
    // factor.
    userVerification: 'required',
    timeout,
  });

  const { challenge } = options;

  await prisma.anonymousVerificationToken.upsert({
    where: {
      id: sessionId,
    },
    update: {
      token: challenge,
      expiresAt: DateTime.now().plus({ minutes: 2 }).toJSDate(),
      createdAt: new Date(),
    },
    create: {
      id: sessionId,
      token: challenge,
      expiresAt: DateTime.now().plus({ minutes: 2 }).toJSDate(),
      createdAt: new Date(),
    },
  });

  return options;
};
