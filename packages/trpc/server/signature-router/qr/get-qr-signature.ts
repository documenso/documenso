import { prisma } from '@documenso/prisma';
import { AnonymousVerificationTokenType } from '@prisma/client';

import { procedure } from '../../trpc';
import { ZGetQrSignatureRequestSchema, ZGetQrSignatureResponseSchema } from './get-qr-signature.types';

/**
 * NOTE: THIS IS A PUBLIC (UNAUTHENTICATED) PROCEDURE.
 *
 * Polled by the desktop signature pad while waiting for a mobile signature.
 *
 * A missing row is indistinguishable from an expired one by design, so we
 * return EXPIRED for both. Once the signature is returned the row is deleted,
 * making the token single-use.
 */
export const getQrSignatureRoute = procedure
  .input(ZGetQrSignatureRequestSchema)
  .output(ZGetQrSignatureResponseSchema)
  .query(async ({ input }) => {
    const { token } = input;

    const qrSignatureSession = await prisma.anonymousVerificationToken.findUnique({
      where: {
        token,
        type: AnonymousVerificationTokenType.QR_SIGNATURE,
      },
    });

    if (!qrSignatureSession || qrSignatureSession.expiresAt < new Date()) {
      return {
        status: 'EXPIRED',
      } as const;
    }

    if (!qrSignatureSession.value) {
      return {
        status: 'PENDING',
      } as const;
    }

    const { count: deletedCount } = await prisma.anonymousVerificationToken.deleteMany({
      where: {
        id: qrSignatureSession.id,
      },
    });

    if (deletedCount === 0) {
      return {
        status: 'EXPIRED',
      } as const;
    }

    return {
      status: 'COMPLETED',
      signature: qrSignatureSession.value,
    } as const;
  });
