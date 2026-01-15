import { sValidator } from '@hono/standard-validator';
import { UserSecurityAuditLogType } from '@prisma/client';
import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import { isoBase64URL } from '@simplewebauthn/server/helpers';
import { Hono } from 'hono';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import type { TAuthenticationResponseJSONSchema } from '@documenso/lib/types/webauthn';
import { ZAuthenticationResponseJSONSchema } from '@documenso/lib/types/webauthn';
import { getAuthenticatorOptions } from '@documenso/lib/utils/authenticator';
import { prisma } from '@documenso/prisma';

import { onAuthorize } from '../lib/utils/authorizer';
import type { HonoAuthContext } from '../types/context';
import { ZPasskeyAuthorizeSchema } from '../types/passkey';

export const passkeyRoute = new Hono<HonoAuthContext>()
  /**
   * Authorize endpoint.
   */
  .post('/authorize', sValidator('json', ZPasskeyAuthorizeSchema), async (c) => {
    const requestMetadata = c.get('requestMetadata');

    const { csrfToken, credential } = c.req.valid('json');

    if (typeof csrfToken !== 'string' || csrfToken.length === 0) {
      throw new AppError(AppErrorCode.INVALID_REQUEST);
    }

    let requestBodyCrediential: TAuthenticationResponseJSONSchema | null = null;

    try {
      const parsedBodyCredential = JSON.parse(credential);
      requestBodyCrediential = ZAuthenticationResponseJSONSchema.parse(parsedBodyCredential);
    } catch {
      throw new AppError(AppErrorCode.INVALID_REQUEST);
    }

    const challengeToken = await prisma.anonymousVerificationToken
      .delete({
        where: {
          id: csrfToken,
        },
      })
      .catch(() => null);

    if (!challengeToken) {
      throw new AppError(AppErrorCode.INVALID_REQUEST);
    }

    if (challengeToken.expiresAt < new Date()) {
      throw new AppError(AppErrorCode.EXPIRED_CODE);
    }

    const passkey = await prisma.passkey.findFirst({
      where: {
        credentialId: Buffer.from(requestBodyCrediential.id, 'base64'),
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            emailVerified: true,
          },
        },
      },
    });

    if (!passkey) {
      throw new AppError(AppErrorCode.NOT_SETUP);
    }

    const user = passkey.user;

    const { rpId, origin } = getAuthenticatorOptions();

    const verification = await verifyAuthenticationResponse({
      response: requestBodyCrediential,
      expectedChallenge: challengeToken.token,
      expectedOrigin: origin,
      expectedRPID: rpId,
      credential: {
        id: isoBase64URL.fromBuffer(passkey.credentialId),
        publicKey: new Uint8Array(passkey.credentialPublicKey),
        counter: Number(passkey.counter),
      },
    }).catch(() => null);

    if (!verification?.verified) {
      await prisma.userSecurityAuditLog.create({
        data: {
          userId: user.id,
          ipAddress: requestMetadata.ipAddress,
          userAgent: requestMetadata.userAgent,
          type: UserSecurityAuditLogType.SIGN_IN_PASSKEY_FAIL,
        },
      });

      throw new AppError(AppErrorCode.INVALID_REQUEST);
    }

    await prisma.passkey.update({
      where: {
        id: passkey.id,
      },
      data: {
        lastUsedAt: new Date(),
        counter: verification.authenticationInfo.newCounter,
      },
    });

    await onAuthorize({ userId: user.id }, c);

    return c.json(
      {
        url: '/',
      },
      200,
    );
  });
