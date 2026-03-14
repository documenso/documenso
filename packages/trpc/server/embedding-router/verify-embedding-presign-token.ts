import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { verifyEmbeddingPresignToken } from '@documenso/lib/server-only/embedding-presign/verify-embedding-presign-token';

import { procedure } from '../trpc';
import {
  ZVerifyEmbeddingPresignTokenRequestSchema,
  ZVerifyEmbeddingPresignTokenResponseSchema,
  verifyEmbeddingPresignTokenMeta,
} from './verify-embedding-presign-token.types';

/**
 * Public route.
 */
export const verifyEmbeddingPresignTokenRoute = procedure
  .meta(verifyEmbeddingPresignTokenMeta)
  .input(ZVerifyEmbeddingPresignTokenRequestSchema)
  .output(ZVerifyEmbeddingPresignTokenResponseSchema)
  .mutation(async ({ input }) => {
    try {
      const { token, scope } = input;

      const apiToken = await verifyEmbeddingPresignToken({
        token,
        scope,
      }).catch(() => null);

      return { success: !!apiToken };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
        message: 'Failed to verify embedding presign token',
      });
    }
  });
