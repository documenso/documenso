import { generateRegistrationOptions } from '@simplewebauthn/server';
import type { AuthenticatorTransportFuture } from '@simplewebauthn/types';
import { DateTime } from 'luxon';

import { prisma } from '@documenso/prisma';

import { PASSKEY_TIMEOUT } from '../../constants/auth';
import { getAuthenticatorOptions } from '../../utils/authenticator';

type CreatePasskeyRegistrationOptions = {
  userId: number;
};

export const createPasskeyRegistrationOptions = async ({
  userId,
}: CreatePasskeyRegistrationOptions) => {
  const user = await prisma.user.findFirstOrThrow({
    where: {
      id: userId,
    },
    select: {
      name: true,
      email: true,
      passkeys: true,
    },
  });

  const { passkeys } = user;

  const { rpName, rpId: rpID } = getAuthenticatorOptions();

  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userID: userId.toString(),
    userName: user.email,
    userDisplayName: user.name ?? undefined,
    timeout: PASSKEY_TIMEOUT,
    attestationType: 'none',
    excludeCredentials: passkeys.map((passkey) => ({
      id: passkey.credentialId,
      type: 'public-key',
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      transports: passkey.transports as AuthenticatorTransportFuture[],
    })),
  });

  await prisma.verificationToken.create({
    data: {
      userId,
      token: options.challenge,
      expires: DateTime.now().plus({ minutes: 2 }).toJSDate(),
      identifier: 'PASSKEY_CHALLENGE',
    },
  });

  return options;
};
