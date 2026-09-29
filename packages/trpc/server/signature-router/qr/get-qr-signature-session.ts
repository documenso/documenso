import { ZQrSignatureContextSchema } from '@documenso/lib/types/qr-signature';
import { prisma } from '@documenso/prisma';
import { AnonymousVerificationTokenType } from '@prisma/client';
import { z } from 'zod';

import { procedure } from '../../trpc';
import {
  ZGetQrSignatureSessionRequestSchema,
  ZGetQrSignatureSessionResponseSchema,
} from './get-qr-signature-session.types';

const ZSessionMetadataSchema = z.object({
  context: ZQrSignatureContextSchema,
});

/**
 * NOTE: THIS IS A PUBLIC (UNAUTHENTICATED) PROCEDURE.
 *
 * Classify a QR signature session token for the mobile signing page and
 * resolve the context stored on the session.
 *
 * A missing row is indistinguishable from an expired one by design.
 *
 * Called once per page load; the global trpc rate limit covers it, matching
 * the polling `qr.get` route.
 */
export const getQrSignatureSessionRoute = procedure
  .input(ZGetQrSignatureSessionRequestSchema)
  .output(ZGetQrSignatureSessionResponseSchema)
  .query(async ({ input }) => {
    const { token } = input;

    const qrSignatureSession = await prisma.anonymousVerificationToken.findUnique({
      where: {
        token,
        type: AnonymousVerificationTokenType.QR_SIGNATURE,
      },
    });

    if (!qrSignatureSession || qrSignatureSession.expiresAt < new Date()) {
      return { status: 'EXPIRED' } as const;
    }

    if (qrSignatureSession.value) {
      return { status: 'ALREADY_SUBMITTED' } as const;
    }

    const parsedMetadata = ZSessionMetadataSchema.nullish().safeParse(qrSignatureSession.metadata);

    if (!parsedMetadata.success) {
      return { status: 'INVALID' } as const;
    }

    // Sessions created without a context are valid, but generic.
    if (!parsedMetadata.data) {
      return { status: 'VALID', context: { type: 'NONE' } } as const;
    }

    const { context } = parsedMetadata.data;

    if (context.type === 'PROFILE_SIGNATURE') {
      return { status: 'VALID', context: { type: context.type } } as const;
    }

    if (context.recipientToken.length < 1) {
      return { status: 'INVALID' } as const;
    }

    const recipient = await prisma.recipient.findFirst({
      where: {
        token: context.recipientToken,
      },
      select: {
        envelope: {
          select: {
            title: true,
            team: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    if (!recipient) {
      return { status: 'INVALID' } as const;
    }

    return {
      status: 'VALID',
      context: {
        type: 'DOCUMENT_SIGNATURE',
        documentTitle: recipient.envelope.title,
        teamName: recipient.envelope.team.name,
      },
    } as const;
  });
