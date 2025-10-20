import { EnvelopeType } from '@prisma/client';

import { getServerLimits } from '@documenso/ee/server-only/limits/server';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { createEnvelope } from '@documenso/lib/server-only/envelope/create-envelope';
import { mapSecondaryIdToDocumentId } from '@documenso/lib/utils/envelope';

import { authenticatedProcedure } from '../trpc';
import {
  ZCreateDocumentRequestSchema,
  ZCreateDocumentResponseSchema,
} from './create-document.types';

export const createDocumentRoute = authenticatedProcedure
  .input(ZCreateDocumentRequestSchema) // Note: Before releasing this to public, update the response schema to be correct.
  .output(ZCreateDocumentResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { user, teamId } = ctx;
    const { title, documentDataId, timezone, folderId } = input;

    ctx.logger.info({
      input: {
        folderId,
      },
    });

    const { remaining } = await getServerLimits({ userId: user.id, teamId });

    if (remaining.documents <= 0) {
      throw new AppError(AppErrorCode.LIMIT_EXCEEDED, {
        message: 'You have reached your document limit for this month. Please upgrade your plan.',
        statusCode: 400,
      });
    }

    const document = await createEnvelope({
      userId: user.id,
      teamId,
      internalVersion: 1,
      data: {
        type: EnvelopeType.DOCUMENT,
        title,
        userTimezone: timezone,
        folderId,
        envelopeItems: [
          {
            documentDataId,
          },
        ],
      },
      normalizePdf: true,
      requestMetadata: ctx.metadata,
    });

    return {
      legacyDocumentId: mapSecondaryIdToDocumentId(document.secondaryId),
    };
  });
