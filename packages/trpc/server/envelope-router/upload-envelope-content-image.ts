import { uploadEnvelopeContentImage } from '@documenso/lib/server-only/envelope-content/upload-envelope-content-image';
import { assertRateLimit } from '@documenso/lib/server-only/rate-limit/rate-limit-middleware';
import { envelopeContentRateLimit } from '@documenso/lib/server-only/rate-limit/rate-limits';

import { authenticatedProcedure } from '../trpc';
import {
  ZUploadEnvelopeContentImageRequestSchema,
  ZUploadEnvelopeContentImageResponseSchema,
} from './upload-envelope-content-image.types';

// Note: This is intended to always be an internal route.
export const uploadEnvelopeContentImageRoute = authenticatedProcedure
  .input(ZUploadEnvelopeContentImageRequestSchema)
  .output(ZUploadEnvelopeContentImageResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { teamId } = ctx;
    const { payload, file } = input;
    const { envelopeId, envelopeContentId } = payload;

    ctx.logger.info({
      input: {
        envelopeId,
        envelopeContentId,
      },
    });

    const rateLimitResult = await envelopeContentRateLimit.check({
      ip: ctx.metadata.requestMetadata.ipAddress ?? 'unknown',
      identifier: String(ctx.user.id),
    });

    assertRateLimit(rateLimitResult);

    const { content, dataContent } = await uploadEnvelopeContentImage({
      userId: ctx.user.id,
      teamId,
      id: {
        type: 'envelopeId',
        id: envelopeId,
      },
      envelopeContentId,
      file,
      requestMetadata: ctx.metadata,
    });

    return {
      content,
      dataContent: {
        id: dataContent.id,
        metadata: dataContent.metadata,
      },
    };
  });
