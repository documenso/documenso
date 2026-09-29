import { QR_SIGNATURE_TOKEN_EXPIRY_MINUTES } from '@documenso/lib/constants/signatures';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { assertRateLimit } from '@documenso/lib/server-only/rate-limit/rate-limit-middleware';
import { qrSignatureCreateRateLimit } from '@documenso/lib/server-only/rate-limit/rate-limits';
import { nanoid } from '@documenso/lib/universal/id';
import { prisma } from '@documenso/prisma';
import { AnonymousVerificationTokenType } from '@prisma/client';
import { DateTime } from 'luxon';

import { procedure } from '../../trpc';
import { ZCreateQrSignatureRequestSchema, ZCreateQrSignatureResponseSchema } from './create-qr-signature.types';

/**
 * NOTE: THIS IS A PUBLIC (UNAUTHENTICATED) PROCEDURE.
 *
 * Creates a short-lived anonymous session which allows a signature drawn on a
 * mobile device to be handed off to the desktop signature pad. The token is
 * the sole authorization for the session.
 */
export const createQrSignatureRoute = procedure
  .input(ZCreateQrSignatureRequestSchema)
  .output(ZCreateQrSignatureResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { context } = input;

    const { ipAddress } = ctx.metadata.requestMetadata;

    const rateLimitResult = await qrSignatureCreateRateLimit.check({
      ip: ipAddress ?? 'unknown',
    });

    assertRateLimit(rateLimitResult);

    if (context?.type === 'DOCUMENT_SIGNATURE') {
      const recipient = await prisma.recipient.findFirst({
        where: {
          token: context.recipientToken,
        },
        select: {
          id: true,
        },
      });

      if (!recipient) {
        throw new AppError(AppErrorCode.NOT_FOUND, {
          message: 'Recipient not found for the provided token',
        });
      }
    }

    const qrSignatureSession = await prisma.anonymousVerificationToken.create({
      data: {
        type: AnonymousVerificationTokenType.QR_SIGNATURE,
        token: nanoid(),
        metadata: context ? { context } : undefined,
        expiresAt: DateTime.now().plus({ minutes: QR_SIGNATURE_TOKEN_EXPIRY_MINUTES }).toJSDate(),
      },
    });

    return {
      token: qrSignatureSession.token,
      expiresAt: qrSignatureSession.expiresAt,
    };
  });
