import { prisma } from '@documenso/prisma';
import { AnonymousVerificationTokenType } from '@prisma/client';
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
    userVerification: 'preferred',
    timeout,
  });

  const { challenge } = options;

  await prisma.anonymousVerificationToken.upsert({
    where: {
      id: sessionId,
    },
    update: {
      type: AnonymousVerificationTokenType.PASSKEY,
      token: challenge,
      expiresAt: DateTime.now().plus({ minutes: 2 }).toJSDate(),
      createdAt: new Date(),
    },
    create: {
      id: sessionId,
      type: AnonymousVerificationTokenType.PASSKEY,
      token: challenge,
      expiresAt: DateTime.now().plus({ minutes: 2 }).toJSDate(),
      createdAt: new Date(),
    },
  });

  return options;
};
