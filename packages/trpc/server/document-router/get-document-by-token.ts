import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { prisma } from '@documenso/prisma';
import { EnvelopeType } from '@prisma/client';

import { authenticatedProcedure } from '../trpc';
import { TWO_FACTOR_SKIP, twoFactorScope } from '../two-factor-enforcement/enforce';
import { ZGetDocumentByTokenRequestSchema, ZGetDocumentByTokenResponseSchema } from './get-document-by-token.types';

export const getDocumentByTokenRoute = authenticatedProcedure
  .input(ZGetDocumentByTokenRequestSchema)
  .output(ZGetDocumentByTokenResponseSchema)
  // Token-authorized: the handler authorizes purely via the recipient token
  // (the session only narrows by email), so both asserts are skipped when the
  // token is present — mirroring the handler's own authorization input. The
  // schema requires a non-empty token, so the fallback (instance assert only,
  // no organisation scope) is unreachable in practice but kept explicit.
  .use(twoFactorScope((input) => (input.token ? TWO_FACTOR_SKIP : {})))
  .query(async ({ input, ctx }) => {
    const { token } = input;

    const envelope = await prisma.envelope.findFirst({
      where: {
        type: EnvelopeType.DOCUMENT,
        recipients: {
          some: {
            token,
            email: ctx.user.email,
          },
        },
      },
      include: {
        envelopeItems: {
          include: {
            documentData: true,
          },
        },
      },
    });

    const firstDocumentData = envelope?.envelopeItems[0].documentData;

    if (!envelope || !firstDocumentData) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Document not found',
      });
    }

    if (envelope.envelopeItems.length !== 1) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'This endpoint does not support multiple items',
      });
    }

    ctx.logger.info({
      documentId: envelope.id,
    });

    return {
      documentData: firstDocumentData,
    };
  });
