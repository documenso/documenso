import { getServerLimits } from '@documenso/ee/server-only/limits/server';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { createEnvelope } from '@documenso/lib/server-only/envelope/create-envelope';

import { authenticatedProcedure } from '../trpc';
import {
  ZCreateEnvelopeRequestSchema,
  ZCreateEnvelopeResponseSchema,
} from './create-envelope.types';

export const createEnvelopeRoute = authenticatedProcedure
  .input(ZCreateEnvelopeRequestSchema) // Note: Before releasing this to public, update the response schema to be correct.
  .output(ZCreateEnvelopeResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { user, teamId } = ctx;
    const {
      title,
      type,
      externalId,
      visibility,
      globalAccessAuth,
      globalActionAuth,
      recipients,
      folderId,
      items,
      meta,
    } = input;

    ctx.logger.info({
      input: {
        folderId,
      },
    });

    // Todo: Envelopes - Put the claims for number of items into this.
    const { remaining } = await getServerLimits({ userId: user.id, teamId });

    if (remaining.documents <= 0) {
      throw new AppError(AppErrorCode.LIMIT_EXCEEDED, {
        message: 'You have reached your document limit for this month. Please upgrade your plan.',
        statusCode: 400,
      });
    }

    const envelope = await createEnvelope({
      userId: user.id,
      teamId,
      internalVersion: 2,
      data: {
        type,
        title,
        externalId,
        visibility,
        globalAccessAuth,
        globalActionAuth,
        recipients,
        folderId,
        envelopeItems: items,
      },
      meta,
      normalizePdf: true,
      requestMetadata: ctx.metadata,
    });

    return {
      id: envelope.id,
    };
  });
