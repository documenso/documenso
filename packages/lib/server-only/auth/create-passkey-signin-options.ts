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
    // A passkey sign-in counts as a trusted second factor (the session is
    // created `twoFactorVerified: true`), so user verification (PIN or
    // biometric) is mandatory — possession of the authenticator alone is a
    // single factor.
    //
    // Release note: authenticators that cannot perform user verification
    // (e.g. some older U2F-style security keys) can no longer be used to sign
    // in; affected users should sign in via another method and register a
    // UV-capable passkey.
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
