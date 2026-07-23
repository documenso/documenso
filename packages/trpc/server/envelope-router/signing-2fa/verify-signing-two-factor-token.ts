import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { verifySigningTwoFactorToken } from '@documenso/lib/server-only/signing-2fa/verify-signing-two-factor-token';
import { prisma } from '@documenso/prisma';

import { procedure } from '../../trpc';
import {
  ZVerifySigningTwoFactorTokenRequestSchema,
  ZVerifySigningTwoFactorTokenResponseSchema,
} from './verify-signing-two-factor-token.types';

export const verifySigningTwoFactorTokenRoute = procedure
  .input(ZVerifySigningTwoFactorTokenRequestSchema)
  .output(ZVerifySigningTwoFactorTokenResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { token, code } = input;

    ctx.logger.info({
      input: {
        token: '***',
      },
    });

    const recipient = await prisma.recipient.findFirst({
      where: {
        token,
      },
      select: {
        id: true,
        envelopeId: true,
      },
    });

    if (!recipient) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Recipient not found',
        statusCode: 404,
      });
    }

    const result = await verifySigningTwoFactorToken({
      recipientId: recipient.id,
      envelopeId: recipient.envelopeId,
      token: code,
      sessionId: token,
    });

    return {
      verified: result!.verified,
      expiresAt: result!.expiresAt,
    };
  });
