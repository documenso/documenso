import { verifyRegistrationResponse } from '@simplewebauthn/server';
import type { RegistrationResponseJSON } from '@simplewebauthn/types';

import { prisma } from '@documenso/prisma';
import { UserSecurityAuditLogType } from '@documenso/prisma/client';

import { MAXIMUM_PASSKEYS } from '../../constants/auth';
import { AppError, AppErrorCode } from '../../errors/app-error';
import type { RequestMetadata } from '../../universal/extract-request-metadata';
import { getAuthenticatorOptions } from '../../utils/authenticator';

type CreatePasskeyOptions = {
  userId: number;
  passkeyName: string;
  verificationResponse: RegistrationResponseJSON;
  requestMetadata?: RequestMetadata;
};

export const createPasskey = async ({
  userId,
  passkeyName,
  verificationResponse,
  requestMetadata,
}: CreatePasskeyOptions) => {
  const { _count } = await prisma.user.findFirstOrThrow({
    where: {
      id: userId,
    },
    include: {
      _count: {
        select: {
          passkeys: true,
        },
      },
    },
  });

  if (_count.passkeys >= MAXIMUM_PASSKEYS) {
    throw new AppError('TOO_MANY_PASSKEYS');
  }

  const verificationToken = await prisma.verificationToken.findFirst({
    where: {
      userId,
      identifier: 'PASSKEY_CHALLENGE',
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  if (!verificationToken) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Challenge token not found',
    });
  }

  await prisma.verificationToken.deleteMany({
    where: {
      userId,
      identifier: 'PASSKEY_CHALLENGE',
    },
  });

  if (verificationToken.expires < new Date()) {
    throw new AppError(AppErrorCode.EXPIRED_CODE, {
      message: 'Challenge token expired',
    });
  }

  const { rpId: expectedRPID, origin: expectedOrigin } = getAuthenticatorOptions();

  const verification = await verifyRegistrationResponse({
    response: verificationResponse,
    expectedChallenge: verificationToken.token,
    expectedOrigin,
    expectedRPID,
  });

  if (!verification.verified || !verification.registrationInfo) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, {
      message: 'Verification failed',
    });
  }

  const { credentialPublicKey, credentialID, counter, credentialDeviceType, credentialBackedUp } =
    verification.registrationInfo;

  await prisma.$transaction(async (tx) => {
    await tx.passkey.create({
      data: {
        userId,
        name: passkeyName,
        credentialId: Buffer.from(credentialID),
        credentialPublicKey: Buffer.from(credentialPublicKey),
        counter,
        credentialDeviceType,
        credentialBackedUp,
        transports: verificationResponse.response.transports,
      },
    });

    await tx.userSecurityAuditLog.create({
      data: {
        userId,
        type: UserSecurityAuditLogType.PASSKEY_CREATED,
        userAgent: requestMetadata?.userAgent,
        ipAddress: requestMetadata?.ipAddress,
      },
    });
  });
};
