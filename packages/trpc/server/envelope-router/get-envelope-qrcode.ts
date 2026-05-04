import { z } from 'zod';

import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { getEnvelopeQrCodeData } from '@documenso/lib/server-only/envelope/get-qrtoken';

import { authenticatedProcedure } from '../trpc';

export const getEnvelopeQrCodeRoute = authenticatedProcedure
  .input(z.object({ envelopeId: z.string() }))
  .output(
    z.object({
      shareToken: z.string().nullable(),
      qrCodeUrl: z.string().url().nullable(),
      documentId: z.number().nullable(),
    }),
  )
  .query(async ({ input, ctx }) => {
    const { envelopeId } = input;
    const { teamId, user } = ctx;

    ctx.logger.info({
      input: {
        envelopeId,
      },
    });

    const row = await getEnvelopeQrCodeData({
      userId: user.id,
      teamId,
      envelopeId,
    });

    if (!row) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Envelope could not be found',
      });
    }

    const shareToken = row.qrToken;

    return {
      documentId: row.documentId,
      shareToken,
      qrCodeUrl: shareToken != null ? `${NEXT_PUBLIC_WEBAPP_URL()}/share/${shareToken}` : null,
    };
  });
