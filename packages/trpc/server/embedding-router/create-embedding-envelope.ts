import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { verifyEmbeddingPresignToken } from '@documenso/lib/server-only/embedding-presign/verify-embedding-presign-token';

import { createEnvelopeRouteCaller } from '../envelope-router/create-envelope';
import { procedure } from '../trpc';
import {
  ZCreateEmbeddingEnvelopeRequestSchema,
  ZCreateEmbeddingEnvelopeResponseSchema,
} from './create-embedding-envelope.types';

export const createEmbeddingEnvelopeRoute = procedure
  .input(ZCreateEmbeddingEnvelopeRequestSchema)
  .output(ZCreateEmbeddingEnvelopeResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { req } = ctx;

    const authorizationHeader = req.headers.get('authorization');

    const [presignToken] = (authorizationHeader || '').split('Bearer ').filter((s) => s.length > 0);

    if (!presignToken) {
      throw new AppError(AppErrorCode.UNAUTHORIZED, {
        message: 'No presign token provided',
      });
    }

    const apiToken = await verifyEmbeddingPresignToken({ token: presignToken });

    const { userId, teamId } = apiToken;

    return await createEnvelopeRouteCaller({
      userId,
      teamId,
      input,
      options: {
        // Default recipients should be added on the frontend automatically for embeds.
        bypassDefaultRecipients: true,
      },
      apiRequestMetadata: ctx.metadata,
    });
  });
