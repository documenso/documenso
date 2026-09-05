import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { assertRateLimit } from '@documenso/lib/server-only/rate-limit/rate-limit-middleware';
import { qrSignatureCompleteRateLimit } from '@documenso/lib/server-only/rate-limit/rate-limits';
import { prisma } from '@documenso/prisma';
import { AnonymousVerificationTokenType } from '@prisma/client';

import { procedure } from '../../trpc';
import { ZCompleteQrSignatureRequestSchema, ZCompleteQrSignatureResponseSchema } from './complete-qr-signature.types';

/**
 * NOTE: THIS IS A PUBLIC (UNAUTHENTICATED) PROCEDURE.
 *
 * Called from the mobile signing page to attach a drawn signature to a QR
 * signature session. The desktop pad picks it up by polling `qr.get`.
 */
export const completeQrSignatureRoute = procedure
  .input(ZCompleteQrSignatureRequestSchema)
  .output(ZCompleteQrSignatureResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { token, signature } = input;

    const { ipAddress } = ctx.metadata.requestMetadata;

    const rateLimitResult = await qrSignatureCompleteRateLimit.check({
      ip: ipAddress ?? 'unknown',
      identifier: token,
    });

    assertRateLimit(rateLimitResult);

    const qrSignatureSession = await prisma.anonymousVerificationToken.findFirst({
      where: {
        token,
        type: AnonymousVerificationTokenType.QR_SIGNATURE,
      },
    });

    if (!qrSignatureSession) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'QR signature session not found or expired',
      });
    }

    if (qrSignatureSession.expiresAt < new Date()) {
      throw new AppError(AppErrorCode.EXPIRED_CODE, {
        message: 'QR signature session has expired',
      });
    }

    if (qrSignatureSession.value) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'A signature has already been submitted for this session',
      });
    }

    const { count: updatedCount } = await prisma.anonymousVerificationToken.updateMany({
      where: {
        id: qrSignatureSession.id,
        type: AnonymousVerificationTokenType.QR_SIGNATURE,
        value: null,
      },
      data: {
        value: signature,
      },
    });

    if (updatedCount === 0) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'A signature has already been submitted for this session',
      });
    }
  });
