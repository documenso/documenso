import { EnvelopeType } from '@prisma/client';

import { getServerLimits } from '@documenso/ee/server-only/limits/server';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { createEnvelope } from '@documenso/lib/server-only/envelope/create-envelope';
import { putNormalizedPdfFileServerSide } from '@documenso/lib/universal/upload/put-file.server';
import { mapSecondaryIdToDocumentId } from '@documenso/lib/utils/envelope';

import { authenticatedProcedure } from '../trpc';
import {
  ZCreateDocumentRequestSchema,
  ZCreateDocumentResponseSchema,
  createDocumentMeta,
} from './create-document.types';

export const createDocumentRoute = authenticatedProcedure
  .meta(createDocumentMeta)
  .input(ZCreateDocumentRequestSchema)
  .output(ZCreateDocumentResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { user, teamId } = ctx;

    const { payload, file } = input;

    const { title, timezone, folderId, attachments } = payload;

    const { id: documentDataId } = await putNormalizedPdfFileServerSide(file);

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
            // If you ever allow more than 1 in this endpoint, make sure to use `maximumEnvelopeItemCount` to limit it.
            documentDataId,
          },
        ],
      },
      attachments,
      normalizePdf: true,
      requestMetadata: ctx.metadata,
    });

    return {
      envelopeId: document.id,
      id: mapSecondaryIdToDocumentId(document.secondaryId),
    };
  });
