import { getServerLimits } from '@documenso/ee/server-only/limits/server';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { createDocument } from '@documenso/lib/server-only/document/create-document';
import { isValidExpirySettings } from '@documenso/lib/utils/expiry';

import { authenticatedProcedure } from '../trpc';
import {
  ZCreateDocumentRequestSchema,
  ZCreateDocumentResponseSchema,
} from './create-document.types';

export const createDocumentRoute = authenticatedProcedure
  .input(ZCreateDocumentRequestSchema)
  .output(ZCreateDocumentResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { user, teamId } = ctx;
    const { title, documentDataId, timezone, folderId, expiryAmount, expiryUnit } = input;

    // Validate expiry settings
    if ((expiryAmount || expiryUnit) && !isValidExpirySettings(expiryAmount, expiryUnit)) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'Invalid expiry settings. Please check your expiry configuration.',
      });
    }

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

    const document = await createDocument({
      userId: user.id,
      teamId,
      title,
      documentDataId,
      normalizePdf: true,
      userTimezone: timezone,
      requestMetadata: ctx.metadata,
      folderId,
      expiryAmount,
      expiryUnit,
    });

    return {
      id: document.id,
    };
  });
