import type { Passkey } from '@prisma/client';
import { generateAuthenticationOptions } from '@simplewebauthn/server';
import type { AuthenticatorTransportFuture } from '@simplewebauthn/types';
import { DateTime } from 'luxon';

import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { getAuthenticatorOptions } from '../../utils/authenticator';

type CreatePasskeyAuthenticationOptions = {
  userId: number;

  /**
   * The ID of the passkey to request authentication for.
   *
   * If not set, we allow the browser client to handle choosing.
   */
  preferredPasskeyId?: string;
};

export const createPasskeyAuthenticationOptions = async ({
  userId,
  preferredPasskeyId,
}: CreatePasskeyAuthenticationOptions) => {
  const { rpId, timeout } = getAuthenticatorOptions();

  let preferredPasskey: Pick<Passkey, 'credentialId' | 'transports'> | null = null;

  if (preferredPasskeyId) {
    preferredPasskey = await prisma.passkey.findFirst({
      where: {
        userId,
        id: preferredPasskeyId,
      },
      select: {
        credentialId: true,
        transports: true,
      },
    });

    if (!preferredPasskey) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Requested passkey not found',
      });
    }
  }

  const options = await generateAuthenticationOptions({
    rpID: rpId,
    userVerification: 'preferred',
    timeout,
    allowCredentials: preferredPasskey
      ? [
          {
            id: preferredPasskey.credentialId,
            type: 'public-key',
            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
            transports: preferredPasskey.transports as AuthenticatorTransportFuture[],
          },
        ]
      : undefined,
  });

  const { secondaryId } = await prisma.verificationToken.create({
    data: {
      userId,
      token: options.challenge,
      expires: DateTime.now().plus({ minutes: 2 }).toJSDate(),
      identifier: 'PASSKEY_CHALLENGE',
    },
  });

  return {
    tokenReference: secondaryId,
    options,
  };
};
