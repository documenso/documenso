import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { getSigningTwoFactorStatus } from '@documenso/lib/server-only/signing-2fa/get-signing-two-factor-status';
import { prisma } from '@documenso/prisma';

import { procedure } from '../../trpc';
import {
  ZGetSigningTwoFactorStatusRequestSchema,
  ZGetSigningTwoFactorStatusResponseSchema,
} from './get-signing-two-factor-status.types';

export const getSigningTwoFactorStatusRoute = procedure
  .input(ZGetSigningTwoFactorStatusRequestSchema)
  .output(ZGetSigningTwoFactorStatusResponseSchema)
  .query(async ({ input, ctx }) => {
    const { token } = input;

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

    return await getSigningTwoFactorStatus({
      recipientId: recipient.id,
      envelopeId: recipient.envelopeId,
      sessionId: token,
    });
  });
